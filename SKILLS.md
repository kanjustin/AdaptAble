# VoiceVision — Skills Reference

Reusable, self-contained implementations for AI coding tools to reference.
Each skill is a complete, copy-pasteable pattern. Do not modify internals unless explicitly needed.

---

## SKILL: SVG Color Blindness Filters

**What it does:** Injects scientifically accurate SVG color matrix filters into the DOM. Apply to `:root` to shift entire page color space.

**When to use:** Any time a colorMode is set in FilterState.

**Component: FilterOverlay.tsx**

```tsx
// src/components/FilterOverlay.tsx
// Render this once in layout.tsx — never conditionally
export function FilterOverlay() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'none' }}
      aria-hidden="true"
    >
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
  );
}
```

**Critical:** `color-interpolation-filters="linearRGB"` must be on every `<filter>`. Without it, the color math is wrong.  
**Reference values from:** Chrome Blink Renderer (most accurate publicly available implementation).

---

## SKILL: Filter Composition and Application

**What it does:** Takes the full FilterState and composes all active filters into one CSS string, then applies to the document root.

**Why one string:** CSS `filter` property is not additive — each assignment overwrites the previous. All transforms must be composed into a single value.

**File: src/lib/filters.ts**

```typescript
import { FilterState } from '@/types';

export function buildFilterString(state: FilterState): string {
  const parts: string[] = [];

  // Color blindness SVG filter (must come first)
  if (state.colorMode === 'achromatopsia') {
    parts.push('grayscale(100%)');
  } else if (state.colorMode) {
    parts.push(`url(#${state.colorMode})`);
  }

  // CSS filter functions (order matters — compose left to right)
  if (state.invertColors) parts.push('invert(100%) hue-rotate(180deg)');
  if (state.warmTone) parts.push('sepia(25%)');
  if (state.highContrast) parts.push('contrast(150%)');
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);

  return parts.join(' ') || 'none';
}

export function applyFilters(state: FilterState): void {
  const root = document.documentElement;
  root.style.filter = buildFilterString(state);

  // Dark mode is separate — controls background/text, not filter pipeline
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
  document.documentElement.style.filter = 'none';
  document.documentElement.style.colorScheme = '';
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
}
```

**Note:** `zoom` mode is not implemented in the filter pipeline — it requires separate DOM manipulation (CSS `transform: scale()` on a wrapper div).

---

## SKILL: Web Speech API Hook

**What it does:** Wraps `SpeechRecognition` / `webkitSpeechRecognition` in a React hook. Returns transcript on final result.

**Constraints:**
- Chrome and Edge only (for SpeechRecognition)
- Requires HTTPS in production (Vercel provides this)
- Works on `http://localhost` in development
- One utterance per button press (`continuous: false`)

**File: src/hooks/useSpeechRecognition.ts**

```typescript
'use client';
import { useState, useRef, useCallback } from 'react';

interface UseSpeechRecognitionReturn {
  transcript: string;
  listening: boolean;
  startListening: () => void;
  supported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    // Stop any existing session first
    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SR() as SpeechRecognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  return { transcript, listening, startListening, supported };
}
```

---

## SKILL: Gemini Intent Parser (API Route)

**What it does:** Receives a voice transcript string, calls Gemini 2.5 Flash with a structured system prompt, returns a validated `AccessibilityCommand` JSON object.

**SDK:** `@google/genai` (the unified 2025+ SDK — not the legacy `@google/generative-ai`)  
**Model:** `gemini-2.5-flash` — free tier, 1,500 req/day, 15 RPM  
**Key feature:** `responseMimeType: 'application/json'` — forces valid JSON output from Gemini, no parsing edge cases

**File: src/app/api/interpret/route.ts**

```typescript
import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { AccessibilityCommand } from '@/types';

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
    if (!transcript) return NextResponse.json({ error: 'No transcript' }, { status: 400 });

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
    return NextResponse.json(command);
  } catch (err) {
    console.error('Gemini error:', err);
    return NextResponse.json({ error: 'Failed to interpret command' }, { status: 500 });
  }
}
```

**Do not change:** model string, responseMimeType, system prompt structure. These are tuned for this use case.

---

## SKILL: Client-Side Command Flow (VoiceButton.tsx)

**What it does:** Ties voice recognition → API call → filter application into one user interaction.

**File: src/components/VoiceButton.tsx (pattern)**

```typescript
'use client';
import { useEffect } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { applyFilters, resetFilters } from '@/lib/filters';
import { defaultFilterState } from '@/types';

interface Props {
  filterState: FilterState;
  onCommand: (cmd: AccessibilityCommand) => void;
  onTranscript: (text: string) => void;
}

export function VoiceButton({ filterState, onCommand, onTranscript }: Props) {
  const { transcript, listening, startListening, supported } = useSpeechRecognition();

  // When a new transcript comes in, send to API
  useEffect(() => {
    if (!transcript) return;
    onTranscript(transcript);

    fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    })
      .then(r => r.json())
      .then(onCommand)
      .catch(console.error);
  }, [transcript]);

  if (!supported) return <p>Voice not supported — use Chrome or Edge</p>;

  return (
    <button
      onClick={startListening}
      disabled={listening}
      className={`... ${listening ? 'animate-pulse' : ''}`}
    >
      {listening ? 'Listening...' : 'Hold to Speak'}
    </button>
  );
}
```

---

## SKILL: Test Content Panel

**What it does:** Provides visible content so filter effects are obvious during the demo. Required — without it judges can't see the accessibility transforms working.

**Inline in page.tsx:**

```tsx
<div className="test-panel">
  {/* Color swatches */}
  <div className="flex gap-2">
    {['#ef4444','#22c55e','#3b82f6','#eab308','#f97316','#a855f7'].map(c => (
      <div key={c} style={{ backgroundColor: c, width: 48, height: 48, borderRadius: 8 }} />
    ))}
  </div>

  {/* Colorful image */}
  <img src="https://picsum.photos/400/200?random=1" alt="Test image" />

  {/* Gradient bar */}
  <div style={{ height: 24, background: 'linear-gradient(to right, red, orange, yellow, green, blue, violet)' }} />

  {/* Text samples */}
  <p className="text-2xl font-bold">Large heading text</p>
  <p className="text-base">Body text — readable in normal and high-contrast modes.</p>
  <p className="text-sm text-gray-400">Small caption text — tests contrast sensitivity.</p>
</div>
```

---

## SKILL: Active Modes Display

**What it does:** Shows currently applied filters as badges. Updates in real time as state changes.

```tsx
// src/components/ActiveModes.tsx
interface Props { state: FilterState }

const MODE_LABELS: Record<string, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Grayscale',
  darkMode: 'Dark Mode',
  highContrast: 'High Contrast',
  warmTone: 'Warm Tone',
  invertColors: 'Inverted',
};

export function ActiveModes({ state }: Props) {
  const active: string[] = [];
  if (state.colorMode) active.push(MODE_LABELS[state.colorMode]);
  if (state.darkMode) active.push('Dark Mode');
  if (state.highContrast) active.push('High Contrast');
  if (state.warmTone) active.push('Warm Tone');
  if (state.invertColors) active.push('Inverted');
  if (state.brightness !== null) active.push(`Brightness ${state.brightness}`);

  if (!active.length) return <p className="text-gray-400">No filters active</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {active.map(label => (
        <span key={label} className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm">
          {label}
        </span>
      ))}
    </div>
  );
}
```
