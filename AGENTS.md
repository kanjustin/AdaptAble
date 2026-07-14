# AdaptAble — Agent Instructions

Read this file first. Works with Cursor, Windsurf, GitHub Copilot, Claude Code, and all other AI coding assistants.

---

## Project Summary

Voice-activated accessibility layer. User speaks → browser transcribes via Web Speech API → Next.js API route sends to Gemini 2.5 Flash → structured JSON returned → CSS/SVG filters applied to screen. 90-minute hackathon build. Prioritize working demo.

**API key:** `GEMINI_API_KEY` from Google AI Studio — free, no credit card, 1,500 requests/day.

---

## Non-Negotiable Rules

1. **SDK is `@google/genai` — NOT `@google/generative-ai`.** The old one is deprecated. Always import `{ GoogleGenAI } from '@google/genai'`.

2. **`response.text` is a property, not a method.** Write `response.text`, never `response.text()`.

3. **`GEMINI_API_KEY` stays server-side.** Never import or reference it in any `'use client'` component or any file not under `app/api/`.

4. **SVG filter defs must be in the DOM.** Render `<FilterOverlay>` in `layout.tsx` before any filter is referenced.

5. **Compose filters into one string.** Call `buildFilterString(state)` and apply once to `document.documentElement.style.filter`. Never set filter twice — last write wins.

6. **`color-interpolation-filters="linearRGB"` on every SVG `<filter>`.** Without it, color matrix math runs in sRGB and the simulation is wrong.

7. **Web Speech API is browser-only.** Guard with `typeof window !== 'undefined'`. Instantiate inside a click handler or `useEffect`.

8. **Use `responseMimeType: 'application/json'` in Gemini config.** This forces valid JSON output — no markdown fences, no preamble, no parsing errors.

---

## File Responsibilities

| File | Purpose |
|---|---|
| `src/app/layout.tsx` | Root layout — renders `<FilterOverlay>` so SVG defs are always in DOM |
| `src/app/page.tsx` | Main UI — voice button, active modes, command history, test content panel |
| `src/app/api/interpret/route.ts` | Gemini API proxy — POST only, server-side, returns `AccessibilityCommand` JSON |
| `src/components/VoiceButton.tsx` | Mic button + speech hook integration |
| `src/components/FilterOverlay.tsx` | Hidden SVG with `<defs>` containing all 3 color matrix filters |
| `src/components/ActiveModes.tsx` | Badges showing currently active filters |
| `src/components/CommandHistory.tsx` | Last 3 commands with Gemini's explanation text |
| `src/hooks/useSpeechRecognition.ts` | Web Speech API wrapper — exposes `{ transcript, listening, startListening }` |
| `src/lib/filters.ts` | `buildFilterString`, `applyFilters`, `resetFilters` |
| `src/types/index.ts` | `AccessibilityCommand` and `FilterState` interfaces |

---

## AccessibilityCommand Type

```typescript
// src/types/index.ts
export interface AccessibilityCommand {
  colorMode: 'deuteranopia' | 'protanopia' | 'tritanopia' | 'achromatopsia' | null;
  darkMode: boolean | null;
  highContrast: boolean | null;
  brightness: number | null;   // 0.1 to 1.5
  warmTone: boolean | null;
  invertColors: boolean | null;
  zoom: 'center' | 'peripheral' | 'full' | null;
  reset: boolean;
  explanation: string;
}

export interface FilterState {
  colorMode: AccessibilityCommand['colorMode'];
  darkMode: boolean;
  highContrast: boolean;
  brightness: number | null;
  warmTone: boolean;
  invertColors: boolean;
}

export const defaultFilterState: FilterState = {
  colorMode: null,
  darkMode: false,
  highContrast: false,
  brightness: null,
  warmTone: false,
  invertColors: false,
};
```

---

## API Route — Exact Implementation

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

---

## SVG Filter Definitions (exact — inject in FilterOverlay.tsx)

```xml
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">
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

## Filter Library — lib/filters.ts

```typescript
import { FilterState } from '@/types';

export function buildFilterString(state: FilterState): string {
  const parts: string[] = [];
  if (state.colorMode === 'achromatopsia') {
    parts.push('grayscale(100%)');
  } else if (state.colorMode) {
    parts.push(`url(#${state.colorMode})`);
  }
  if (state.invertColors) parts.push('invert(100%) hue-rotate(180deg)');
  if (state.warmTone) parts.push('sepia(25%)');
  if (state.highContrast) parts.push('contrast(150%)');
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);
  return parts.join(' ') || 'none';
}

export function applyFilters(state: FilterState): void {
  const root = document.documentElement;
  root.style.filter = buildFilterString(state);
  if (state.darkMode) {
    root.style.colorScheme = 'dark';
    document.body.style.backgroundColor = '#0f0f0f';
    document.body.style.color = '#f0f0f0';
  } else {
    root.style.colorScheme = '';
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
  }
}

export function resetFilters(): void {
  const root = document.documentElement;
  root.style.filter = 'none';
  root.style.colorScheme = '';
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
}
```

---

## Web Speech API Hook

```typescript
// src/hooks/useSpeechRecognition.ts
'use client';
import { useState, useRef } from 'react';

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Use Chrome or Edge for voice support.'); return; }

    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      setTranscript(e.results[0][0].transcript);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  return { transcript, listening, startListening };
}
```

---

## State Merging (in page.tsx)

```typescript
const handleCommand = (cmd: AccessibilityCommand) => {
  if (cmd.reset) {
    setFilterState(defaultFilterState);
    resetFilters();
    return;
  }
  setFilterState(prev => {
    const next: FilterState = {
      colorMode: cmd.colorMode ?? prev.colorMode,
      darkMode: cmd.darkMode ?? prev.darkMode,
      highContrast: cmd.highContrast ?? prev.highContrast,
      brightness: cmd.brightness ?? prev.brightness,
      warmTone: cmd.warmTone ?? prev.warmTone,
      invertColors: cmd.invertColors ?? prev.invertColors,
    };
    applyFilters(next);
    return next;
  });
};
```

---

## Demo Test Panel (required in page.tsx)

Without visible content, filter effects aren't obvious to judges. Render this on the page:
- Row of color swatches: red, green, blue, yellow, orange, purple
- A colorful image: `https://picsum.photos/400/200?random=1`
- Sample text in multiple sizes
- A CSS gradient bar

---

## Tool-Specific Notes

**Cursor:** Put this file at project root. Use `@AGENTS.md` in chat to pull context.  
**Windsurf:** Reads AGENTS.md automatically from project root.  
**GitHub Copilot:** Copy content to `.github/copilot-instructions.md`.  
**Claude Code:** Reads CLAUDE.md primarily; symlink AGENTS.md if needed.

## Mid-Session Handoff Template

Paste this when switching tools:
```
Continuing AdaptAble — voice-activated accessibility app.
Read AGENTS.md and CLAUDE.md in project root for full context.
Stack: Next.js + @google/genai (gemini-2.5-flash) + Web Speech API + SVG CSS filters.
Current status: [what's working]
Next task: [what to build]
```
