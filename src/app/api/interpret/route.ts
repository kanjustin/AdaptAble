import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { AccessibilityCommand } from '@/types';

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

const SYSTEM_PROMPT = `You are an accessibility assistant. The user speaks NATURAL LANGUAGE — they may describe symptoms, conditions, feelings, or use casual/medical terms. Parse their intent and return ONLY valid JSON matching this exact schema:

{
  "colorMode": "deuteranopia" | "protanopia" | "tritanopia" | "achromatopsia" | null,
  "darkMode": boolean | null,
  "highContrast": boolean | null,
  "brightness": number (0.1-1.5) | null,
  "warmTone": boolean | null,
  "invertColors": boolean | null,
  "zoom": "center" | "peripheral" | "full" | null,
  "reset": boolean,
  "explanation": "one sentence summary of what you applied"
}

COLOR VISION:
- "red-green colorblind", "can't tell red from green", "colors blend together", "confuse red and green" → deuteranopia
- "protanopia", "red weakness", "reds look dark" → protanopia
- "blue-yellow colorblind", "tritanopia" → tritanopia
- "no color vision", "everything is gray", "achromatopsia", "monochrome" → achromatopsia

VISION CONDITIONS:
- "macular degeneration", "blind spot in center", "can't see what I'm looking at directly", "AMD", "central vision loss" → zoom: "center"
- "glaucoma", "tunnel vision", "can't see the sides", "peripheral vision loss", "losing my side vision" → zoom: "peripheral"
- "low vision", "need everything bigger", "can't read small text", "magnify", "zoom in", "make things larger" → zoom: "full"

DISPLAY COMFORT:
- "dark mode", "make it dark", "too white", "white background hurts" → darkMode: true
- "too bright", "hurts my eyes", "screen is blinding", "dim it", "lower brightness" → darkMode: true, brightness: 0.6
- "low contrast", "can't read the text", "text is hard to see", "everything looks faded", "washed out" → highContrast: true
- "light sensitive", "photophobia", "fluorescent lights bother me", "screen gives me headaches" → darkMode: true, warmTone: true
- "warm it up", "reduce blue light", "night mode", "easier on my eyes at night" → warmTone: true
- "flip the colors", "invert", "reverse colors" → invertColors: true

RESET:
- "reset", "normal", "clear", "undo", "go back", "turn everything off", "start over", "remove all filters" → reset: true, all other fields null

IMPORTANT:
- Compound commands set multiple fields at once (e.g., "dark and high contrast" → darkMode: true, highContrast: true)
- The user may describe symptoms instead of naming conditions — infer the best adaptation
- reset is always boolean, never null
- Fields not mentioned should be null (not false) so they don't override existing state
- If the user asks to remove/disable ONE specific filter (e.g., "turn off dark mode"), set ONLY that field to its off value (false/null) and leave everything else null`;

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();
    if (!transcript) {
      return NextResponse.json({ error: 'No transcript' }, { status: 400, headers: CORS_HEADERS });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: transcript }] }],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        maxOutputTokens: 256,
        temperature: 0.1,
      },
    });

    const command: AccessibilityCommand = JSON.parse(response.text ?? '{}');
    return NextResponse.json(command, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('Gemini error:', err);
    return NextResponse.json({ error: 'Failed to interpret command' }, { status: 500, headers: CORS_HEADERS });
  }
}
