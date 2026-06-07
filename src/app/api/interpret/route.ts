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

const SYSTEM_PROMPT = `You are an accessibility assistant. The user speaks natural language describing their visual needs or symptoms. Parse their intent and return ONLY valid JSON matching this exact schema:

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

Inference rules:
- "red-green colorblind" → deuteranopia
- "colors look washed out" or "low contrast" → highContrast: true
- "too bright" or "hurts my eyes" → darkMode: true, brightness: 0.6
- "macular degeneration" → zoom: "center"
- "glaucoma" or "tunnel vision" → zoom: "peripheral"
- "light sensitive" or "photophobia" → darkMode: true, warmTone: true
- "reset" or "normal" or "clear" → reset: true, all other fields null
- Compound commands set multiple fields at once
- reset is always boolean, never null`;

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
