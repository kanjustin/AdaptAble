import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { AccessibilityCommand, FilterState } from '@/types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Allows the browser extension (chrome-extension:// origin) and the web app to call this route.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const SYSTEM_PROMPT = `You are an accessibility assistant. The user speaks NATURAL LANGUAGE — they may describe symptoms, conditions, feelings, or use casual/medical terms. You will also receive the CURRENT STATE of the page's filters as JSON. Parse the user's intent and return ONLY valid JSON matching this exact schema:

{
  "colorMode": "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia" | null,
  "darkMode": boolean | null,
  "highContrast": boolean | null,
  "brightness": number (0.1-1.5) | null,
  "warmTone": boolean | null,
  "invertColors": boolean | null,
  "blur": boolean | null,
  "hemianopia": "left" | "right" | null,
  "zoom": "center" | "peripheral" | "full" | null,
  "dimOverlay": boolean | null,
  "boldText": boolean | null,
  "reduceMotion": boolean | null,
  "intensities": {
    "colorMode": number (0-1) | undefined,
    "darkMode": number (0-1) | undefined,
    "highContrast": number (0-1) | undefined,
    "warmTone": number (0-1) | undefined,
    "invertColors": number (0-1) | undefined,
    "blur": number (0-1) | undefined,
    "zoom": number (0-1) | undefined,
    "dimOverlay": number (0-1) | undefined
  } | null,
  "reset": boolean,
  "explanation": "one sentence summary of what you applied"
}

COLOR VISION:
- "red-green colorblind", "can't tell red from green", "colors blend together", "confuse red and green" → colorMode: "deuteranopia"
- "protanopia", "red weakness", "reds look dark" → colorMode: "protanopia"
- "blue-yellow colorblind", "tritanopia" → colorMode: "tritanopia"
- "no color vision", "everything is gray", "achromatopsia", "monochrome" → colorMode: "achromatopsia"
- "mild" / "slight" version of any of the above → also set intensities.colorMode to ~0.4
- "severe" / "total" / "complete" version → also set intensities.colorMode to 1

LOW VISION / CATARACTS (blur field — applies a contrast/brightness clarity boost to cut through haze, NOT additional blur):
- "cataracts", "everything is blurry/foggy/hazy", "my vision is cloudy", "can't focus" → blur: true

VISUAL FIELD LOSS:
- "macular degeneration", "blind spot in center", "can't see what I'm looking at directly", "AMD", "central vision loss" → zoom: "center"
- "glaucoma", "tunnel vision", "can't see the sides", "peripheral vision loss", "losing my side vision" → zoom: "peripheral"
- "low vision", "need everything bigger", "can't read small text", "magnify", "zoom in", "make things larger" → zoom: "full"
- "stroke", "lost vision on my left/right side", "blind on my left/right", "left/right visual field is gone", "hemianopia" → hemianopia: "left" or "right" matching the side mentioned

DISPLAY COMFORT:
- "dark mode", "make it dark", "too white", "white background hurts" → darkMode: true
- "too bright", "hurts my eyes", "screen is blinding", "dim it", "lower brightness" → darkMode: true, brightness: 0.6
- "low contrast", "can't read the text", "text is hard to see", "everything looks faded", "washed out" → highContrast: true
- "light sensitive", "photophobia", "migraine", "fluorescent lights bother me", "screen gives me headaches", "bright lights hurt" → dimOverlay: true, warmTone: true
- "warm it up", "reduce blue light", "night mode", "easier on my eyes at night" → warmTone: true
- "flip the colors", "invert", "reverse colors" → invertColors: true

READING / FOCUS:
- "astigmatism", "things look smeared or doubled", "presbyopia", "hard to focus up close", "letters look fuzzy or thin", "text is hard to make out" → boldText: true

MOTION SENSITIVITY:
- "motion sickness", "animations make me dizzy", "vestibular", "autoplay videos bother me", "reduce motion", "moving things make me nauseous" → reduceMotion: true

RELATIVE / MAGNITUDE COMMANDS (use the provided currentState to compute these):
- "darker" / "make it dimmer" → if darkMode is already on, increase intensities.darkMode by ~0.2 above currentState.intensities.darkMode (clamp 0-1) and leave darkMode null; if darkMode is off, set darkMode: true
- "lighter" / "less dark" / "brighten it" → decrease intensities.darkMode by ~0.2 (clamp 0-1); if it would go to 0, set darkMode: false instead and intensities.darkMode null
- "more contrast" / "increase contrast" → increase intensities.highContrast by ~0.2 (clamp 0-1), set highContrast: true if not already on
- "less contrast" → decrease intensities.highContrast by ~0.2 (clamp 0-1)
- "zoom in more" / "magnify more" / "bigger" → if zoom is already "full"/"center"/"peripheral", increase intensities.zoom by ~0.2 above currentState.intensities.zoom (clamp 0-1) and leave zoom null; if zoom is currently null, set zoom: "full" and intensities.zoom: 0.5
- "zoom out" / "less zoom" / "smaller" → decrease intensities.zoom by ~0.2 (clamp 0-1)
- "more blur" / "blurrier" → increase intensities.blur by ~0.2 (clamp 0-1), set blur: true if not already on
- "less blur" / "sharper" → decrease intensities.blur by ~0.2 (clamp 0-1)
- "less severe" / "tone it down" applied to a color-blindness mode → decrease intensities.colorMode by ~0.2 (clamp 0-1)
- "more severe" / "stronger" applied to a color-blindness mode → increase intensities.colorMode by ~0.2 (clamp 0-1)
- Always compute the NEW absolute intensity value (current ± 0.2, clamped to [0,1]) — never return a delta
- If currentState is missing or the relevant field has no current intensity, assume a baseline of 0.5 before applying the ± 0.2 step

RESET:
- "reset", "normal", "clear", "undo", "go back", "turn everything off", "start over", "remove all filters" → reset: true, all other fields null

CRITICAL RULES:
- COMPOUND COMMANDS: Users often mention MULTIPLE conditions at once. You MUST set ALL relevant fields simultaneously. Examples:
  * "I have deuteranopia and tunnel vision" → colorMode: "deuteranopia", zoom: "peripheral"
  * "dark mode and high contrast" → darkMode: true, highContrast: true
  * "I'm colorblind and the screen is too bright" → colorMode: "deuteranopia", darkMode: true, brightness: 0.6
  * "macular degeneration and everything is washed out" → zoom: "center", highContrast: true
- Fields not mentioned should be null (NEVER false) so they don't override existing state
- intensities is null unless the command implies a magnitude change (mild/severe, more/less, darker/lighter, zoom in/out, etc.) — only include the specific keys that changed, omit (or leave undefined) the rest
- reset is always boolean, never null
- The user may describe symptoms instead of naming conditions — infer the best adaptation
- If the user asks to remove/disable ONE specific filter (e.g., "turn off dark mode"), set ONLY that field to its off value (false/null) and leave everything else null
- NEVER return false for fields the user didn't mention — use null instead`;

export async function POST(req: NextRequest) {
  try {
    const { transcript, currentState } = (await req.json()) as {
      transcript?: string;
      currentState?: FilterState;
    };
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript' }, { status: 400, headers: CORS_HEADERS });
    }

    const userContent = currentState
      ? `currentState: ${JSON.stringify(currentState)}\ntranscript: ${transcript}`
      : transcript;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        maxOutputTokens: 384,
        temperature: 0.1,
      },
    });

    let raw = response.text ?? '';

    if (!raw.trim()) {
      const part = response.candidates?.[0]?.content?.parts?.find(
        (p: { thought?: boolean; text?: string }) => !p.thought && p.text
      );
      raw = part?.text ?? '';
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON in Gemini response:', raw);
      return NextResponse.json({ error: 'Failed to interpret command' }, { status: 500, headers: CORS_HEADERS });
    }

    const command: AccessibilityCommand = JSON.parse(jsonMatch[0]);

    const boolKeys = ['darkMode', 'highContrast', 'warmTone', 'invertColors', 'blur', 'dimOverlay', 'boldText', 'reduceMotion'] as const;
    const allKeys = ['colorMode', ...boolKeys, 'brightness', 'zoom', 'hemianopia', 'intensities'] as const;

    const hasPositive = allKeys.some(k => {
      const v = command[k];
      return v !== null && v !== undefined && v !== false;
    });

    if (hasPositive) {
      for (const key of boolKeys) {
        if (command[key] === false) {
          command[key] = null;
        }
      }
    }

    return NextResponse.json(command, { headers: CORS_HEADERS });
  } catch (err: unknown) {
    console.error('Gemini error:', err);
    const errShape = err as { status?: number; httpStatusCode?: number } | null;
    const status = errShape?.status || errShape?.httpStatusCode || 500;
    if (status === 429) {
      return NextResponse.json(
        { error: 'Rate limit reached — try again in a minute' },
        { status: 429, headers: CORS_HEADERS }
      );
    }
    return NextResponse.json({ error: 'Failed to interpret command' }, { status: 500, headers: CORS_HEADERS });
  }
}
