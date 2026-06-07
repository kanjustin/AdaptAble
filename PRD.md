# VoiceVision — Product Requirements Document

**Hackathon:** AI Hackathon with The AI Collective Tri-Valley | Humans in AI Week  
**Date:** June 7, 2026 | Build window: 11:40 AM – 1:10 PM (90 minutes)  
**Track:** Track 2 — AI for Accessibility  
**Judging:** Technical Implementation · Human-AI Collaboration · Impact & Relevance · Presentation & Demo (each 1–5)

---

## Problem

300+ million people worldwide have some form of visual impairment. Most rely on system-level accessibility settings buried in OS menus that require technical knowledge and interrupt workflow. Color blindness affects ~8% of males. Low vision, light sensitivity, and contrast disorders affect millions more.

No existing tool lets someone say "my eyes hurt" or "I have red-green colorblindness" and have their screen adapt instantly.

---

## Solution

VoiceVision is a voice-activated accessibility layer that adapts any screen in real-time using natural language. A user speaks a command — anything from "make it dark" to "I have deuteranopia" — and the app uses Gemini to interpret intent, then applies the correct visual transform immediately.

The AI layer is the differentiator. This is not a toggle menu. Gemini parses medical terminology, colloquial descriptions, symptom language, and compound commands.

---

## Target Users

- People with color vision deficiencies (deuteranopia, protanopia, tritanopia, achromatopsia)
- People with low vision / macular degeneration (center magnification)
- People with glaucoma (peripheral magnification)
- People with light sensitivity / photophobia
- People with contrast sensitivity disorders
- Anyone in a temporary situation (bright room, migraine, tired eyes)

---

## Scope for 90-Minute Build

### Must ship
- Voice capture via Web Speech API
- Next.js API route → Gemini 2.5 Flash → structured command JSON
- Real-time CSS/SVG visual transforms applied to page
- At least 6 distinct modes working
- Active mode display
- Reset command

### Nice to have
- Mode stacking (dark mode + color filter simultaneously)
- Voice confirmation via SpeechSynthesis

### Out of scope
- User accounts / persistence
- Multi-page / OS-level apply
- Mobile optimization

---

## API Stack

### AI: Google Gemini 2.5 Flash via @google/genai SDK

**Why free:** Google AI Studio free tier covers Gemini 2.5 Flash — no credit card required.  
**Free tier limits:** 1,500 requests/day, 15 requests/minute, 1M tokens/minute.  
**For a 90-minute demo:** 15 RPM is plenty. 1,500 RPD will never be hit.  
**Get key at:** https://aistudio.google.com/apikey

**SDK (current, unified — not the legacy one):**
```bash
npm install @google/genai
```

**Usage pattern:**
```typescript
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const response = await ai.models.generateContent({
  model: 'gemini-2.5-flash',
  contents: [...],
  config: {
    systemInstruction: SYSTEM_PROMPT,
    responseMimeType: 'application/json',  // forces clean JSON — no parsing issues
    temperature: 0.1,
    maxOutputTokens: 256,
  },
});
const result = JSON.parse(response.text); // response.text is a property, not a method
```

**Note:** Gemini 2.0 Flash and 2.0 Flash-Lite are deprecated and shut down as of June 1, 2026. Use 2.5 Flash.

### Voice: Web Speech API (browser-native, free, no setup)

- Zero cost, zero API key
- Chrome 25+ and Edge (Chromium) — run demo on Chrome
- Routes audio to Google servers for transcription (works over HTTPS or localhost)
- `webkitSpeechRecognition` prefix still required for Chrome

### Visual FX: SVG feColorMatrix + CSS filter property

- Zero cost, zero libraries
- SVG color matrix filters for clinically accurate color blindness simulation
- CSS filter functions for brightness, contrast, warmth, invert
- Applied to `document.documentElement` for full-page effect

---

## Command Schema

Gemini returns this JSON. `responseMimeType: 'application/json'` guarantees it.

```typescript
interface AccessibilityCommand {
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
```

---

## Visual Modes

### Color Blindness (SVG feColorMatrix — Chrome Blink values)

| Mode | Condition | Population |
|---|---|---|
| deuteranopia | Green cone deficiency | ~5% of males |
| protanopia | Red cone deficiency | ~1% of males |
| tritanopia | Blue cone deficiency | ~0.01% |
| achromatopsia | Full color blindness | ~0.003% — uses CSS grayscale |

### Brightness / Contrast
- **darkMode** — `background: #0f0f0f`, `color: #f0f0f0`
- **warmTone** — `sepia(25%)` reduces blue light
- **highContrast** — `contrast(150%)`
- **brightness** — `brightness(0.6)` for dimming, etc.
- **invertColors** — `invert(100%) hue-rotate(180deg)`

---

## Environment Variables

```
GEMINI_API_KEY=AIza...
```

One variable. No other credentials needed. Get it free at aistudio.google.com.

---

## Deployment

Vercel Hobby tier — free, HTTPS automatic, Next.js native.  
100GB/month bandwidth. 1,500 RPD on Gemini free tier is plenty.

---

## Judging Alignment

| Criterion | How we win |
|---|---|
| Technical Implementation | Gemini + Web Speech API + SVG filter pipeline all working live |
| Human-AI Collaboration | Voice IS the human interface. Gemini interprets human language — including medical terms and symptom descriptions — into machine commands. Human stays in control. |
| Impact & Relevance | 300M+ people affected. Accepts diagnosis terminology (deuteranopia, photophobia) as natural input. |
| Presentation & Demo | Live voice command → visible screen transform. No slides needed. |

---

## Demo Script

1. Open app. Show the test content panel (color swatches, image, gradient).
2. Say: **"I have red-green colorblindness"** → deuteranopia filter applies visibly
3. Say: **"Also make it darker, I'm light sensitive"** → dark mode stacks on
4. Say: **"Reset to normal"** → all clear
5. Explain: "Gemini isn't doing keyword matching — it understands symptoms, medical diagnoses, and compound requests. This is AI serving accessibility, not the other way around."

---

## Git Commit Strategy

First commit at 11:40 AM. All commits after official start. Judges check timestamps.

```
11:40 — init: Next.js scaffold
11:55 — feat: Gemini API route returning command JSON
12:10 — feat: voice pipeline + deuteranopia and dark mode working
12:30 — feat: all 6 modes + reset verified
12:45 — feat: UI polish + active mode display + test panel
12:55 — feat: production deploy on Vercel
```
