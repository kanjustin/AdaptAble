# VoiceVision — Claude Code Context

## What This Is

VoiceVision is a voice-activated accessibility layer built for a 90-minute hackathon sprint. Users speak natural language commands describing their visual needs or impairments, Gemini 2.5 Flash interprets intent, and the app applies the correct CSS/SVG visual transforms to the screen in real time.

**Track:** AI for Accessibility (Humans in AI Week hackathon)  
**Constraint:** Everything must be built within the hackathon window.  
**Priority:** Working demo > clean code. Ship fast.

---

## Stack

- **Framework:** Next.js 14+ with App Router (TypeScript)
- **Styling:** Tailwind CSS
- **Voice input:** Web Speech API (`webkitSpeechRecognition` with `SpeechRecognition` fallback)
- **AI:** `@google/genai` SDK — model `gemini-2.5-flash`
- **Visual FX:** Inline SVG `feColorMatrix` filters + CSS `filter` property applied to `:root`
- **Deployment:** Vercel Hobby (free)
- **API key:** `GEMINI_API_KEY` from Google AI Studio — no credit card, no cost

---

## Project Structure

```
src/
  app/
    layout.tsx          # Injects SVG filter defs into DOM
    page.tsx            # Main UI + test content panel
    api/
      interpret/
        route.ts        # POST handler — transcript → Gemini → command JSON
  components/
    VoiceButton.tsx     # Mic button, holds useSpeechRecognition hook
    FilterOverlay.tsx   # Hidden SVG filter definitions injected into DOM
    ActiveModes.tsx     # Displays currently applied modes
    CommandHistory.tsx  # Last 3 commands with explanations
  hooks/
    useSpeechRecognition.ts  # Web Speech API wrapper
  lib/
    filters.ts          # buildFilterString + applyFilters + resetFilters
  types/
    index.ts            # AccessibilityCommand type definition
```

---

## The Command Schema

The API route returns this exact shape.

```typescript
interface AccessibilityCommand {
  colorMode: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia' | null;
  darkMode: boolean | null;
  highContrast: boolean | null;
  brightness: number | null;        // range 0.1–1.5
  warmTone: boolean | null;
  invertColors: boolean | null;
  zoom: 'center' | 'peripheral' | 'full' | null;
  reset: boolean;
  explanation: string;              // always populated — 1 sentence
}
```

---

## API Route — /api/interpret

**IMPORTANT:** Use `@google/genai` (not `@google/generative-ai` — that is the old deprecated SDK).

```typescript
// src/app/api/interpret/route.ts
import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

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

Rules:
- "red-green colorblind" or "can't see red and green" → deuteranopia
- "colors look washed out" → highContrast: true
- "too bright" or "hurts my eyes" → darkMode: true, brightness: 0.6
- "macular degeneration" → zoom: "center"
- "glaucoma" or "tunnel vision" → zoom: "peripheral"
- "light sensitive" or "photophobia" → darkMode: true, warmTone: true
- "reset" or "normal" or "clear" → reset: true, all other fields null
- Compound commands set multiple fields simultaneously
- reset is always true or false, never null`;

export async function POST(req: NextRequest) {
  const { transcript } = await req.json();

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

  const command = JSON.parse(response.text ?? '{}');
  return NextResponse.json(command);
}
```

Key advantage of `responseMimeType: 'application/json'`: Gemini is forced to return valid JSON only — no markdown fences, no preamble, no parsing errors.

---

## SVG Filter Values (exact — do not modify)

Chrome Blink renderer values. `color-interpolation-filters="linearRGB"` is required.

```xml
<svg xmlns="http://www.w3.org/2000/svg" style="display:none">
  <defs>
    <filter id="deuteranopia" color-interpolation-filters="linearRGB">
      <feColorMatrix type="matrix" values="
        0.367  0.861 -0.228  0  0
        0.280  0.673  0.047  0  0
       -0.012  0.043  0.969  0  0
        0      0      0      1  0"/>
    </filter>
    <filter id="protanopia" color-interpolation-filters="linearRGB">
      <feColorMatrix type="matrix" values="
        0.152  0.848  0      0  0
        0.114  0.886  0      0  0
        0      0.094  0.906  0  0
        0      0      0      1  0"/>
    </filter>
    <filter id="tritanopia" color-interpolation-filters="linearRGB">
      <feColorMatrix type="matrix" values="
        1      0.168 -0.168  0  0
        0      0.920  0.080  0  0
        0      0.923  0.077  0  0
        0      0      0      1  0"/>
    </filter>
  </defs>
</svg>
```

---

## Filter Composition (lib/filters.ts)

Always compose into one string and apply once to `document.documentElement`. Never set filter twice.

```typescript
export function buildFilterString(state: FilterState): string {
  const parts: string[] = [];
  if (state.colorMode === 'achromatopsia') parts.push('grayscale(100%)');
  else if (state.colorMode) parts.push(`url(#${state.colorMode})`);
  if (state.invertColors) parts.push('invert(100%) hue-rotate(180deg)');
  if (state.warmTone) parts.push('sepia(25%)');
  if (state.highContrast) parts.push('contrast(150%)');
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);
  return parts.join(' ') || 'none';
}
```

---

## Critical Gotchas

1. `@google/genai` not `@google/generative-ai` — the old one is deprecated
2. `response.text` is a property, not a method — no `response.text()`
3. `color-interpolation-filters="linearRGB"` on every SVG filter — without it, simulation is scientifically wrong
4. Compose filters into one string before applying — do not call `element.style.filter` twice
5. Web Speech API is browser-only — guard with `typeof window !== 'undefined'`
6. `GEMINI_API_KEY` stays server-side — API route only, never in client components
7. SVG defs must be in DOM before any `url(#id)` reference — render FilterOverlay in layout.tsx

---

## Development Commands

```bash
npm install
npm run dev          # localhost:3000 — voice works on http in dev
```

Get Gemini API key at https://aistudio.google.com/apikey (free, no card).

---

## What "Done" Looks Like

- [ ] Voice button captures speech and shows transcript
- [ ] API route returns valid command JSON from Gemini
- [ ] At least 6 modes apply: deuteranopia, protanopia, dark mode, high contrast, warm tone, reset
- [ ] Active modes displayed on screen
- [ ] Claude explanation text shown after each command
- [ ] Test content panel visible (color swatches, image, text)
- [ ] Deployed to Vercel with working URL
