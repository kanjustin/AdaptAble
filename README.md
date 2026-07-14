# AdaptAble

**A voice-controlled accessibility layer for the web.** Describe what's hard about a webpage in your own words — *"this is too small,"* *"the page is too busy,"* *"the white hurts my eyes"* — and AdaptAble safely restructures the page around your needs. No settings menus, no jargon, no contrast ratios.

Built for **The Vakathon** (San Ramon, CA — July 11, 2026). Theme: *code that makes a real, useful impact in the community.*

---

## The problem

People usually know a page is hard to use, but not *which* accessibility setting fixes it. Browser and OS accessibility tools are scattered, technical, and assume you know terms like "line height," "reduced motion," or "reader view." That leaves out exactly the people who need them most.

## Who it's for

An older adult trying to pay a utility bill, refill a prescription, or read city-service instructions — plus anyone with low vision, cognitive overload, migraines, motion sensitivity, or reading difficulty. You say what's wrong; the page adapts.

## What it does — two clearly separated modes

### 1. Assist Mode (the product)
Genuine, reversible improvements to real pages:
- **Simplify this page** — extract the main content, hide nav/ads/sidebars/popups/cookie banners, apply readable typography (the centerpiece)
- Larger text · more line/letter/paragraph spacing · bolder text
- High contrast · dark mode · dim (for "too bright") · warm colors
- Reduce motion · focus highlighting
- **Color Distinction Assistance** (help tell colors apart — *not* a simulation)
- Move content left/right · read aloud (with pause/resume/stop)
- Undo · Reset · before/after (undo) · persistent preferences

### 2. Developer Simulation Mode (separate, clearly labeled)
> Simulation Mode helps **developers** inspect possible accessibility barriers. It is **not** a medical diagnostic or corrective tool, and it does not help people who have these conditions.

Deuteranopia / protanopia / tritanopia / achromatopsia, central- & peripheral-field loss, hemianopia, cataracts. These were the original project's core; we relabeled and separated them, because *simulating* a condition is not *assisting* the person who has it.

---

## How it works (not a thin LLM wrapper)

```
speech / typed input
        │
        ▼
  Local parser  ──confident──►  Action Engine (predefined, reversible DOM/CSS only)
        │ ambiguous                      ▲
        ▼                                │
  POST /api/interpret → Gemini → Zod .strict() validation ─┘
     (sends ONLY the command text + current settings — never page content)
        │
        ▼
  Typed state + undo history  →  Transparency panel (source, latency, "no page content sent")
```

- **Local deterministic parser** handles the common commands **instantly and offline** (100% exact-intent accuracy on our eval set, ~0.006 ms median).
- **Gemini** is asked *only* for wording the parser doesn't recognize, and it returns **structured intent only** — validated by a strict Zod schema that rejects unknown keys, bounds every number, and has no field for code, CSS, or selectors.
- **The extension** performs only predefined transformations. Nothing the model says is executed.

See [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [PRIVACY.md](PRIVACY.md).

---

## Install & run the extension (Chrome / Edge)

1. `git clone https://github.com/kanjustin/AdaptAble.git`
2. Open `chrome://extensions`, enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the **`comis/`** folder.
4. Open any normal website and click the Comis toolbar icon.
5. Type or speak a request (e.g. *"simplify this page and make the text bigger"*).

The extension calls a small hosted API only for ambiguous phrasing; everything else runs locally.

## Run the web app / API (for development or self-hosting the AI fallback)

```bash
npm install
cp .env.example .env.local     # add your GEMINI_API_KEY (free, no card)
npm run dev                    # http://localhost:3000
```
Open `http://localhost:3000/demo.html` for the cluttered demo page.

### Environment variables
| Var | Where | Purpose |
|-----|-------|---------|
| `GEMINI_API_KEY` | server only (`.env.local`) | AI fallback for ambiguous phrasing. Optional — common commands work without it. |

## Development commands
```bash
npm run dev            # web app + API on :3000
npm run build          # production build
npm run lint           # eslint (0 errors)
npm test               # simplify regression test + parser eval (asserts thresholds)
npm run eval           # parser evaluation report (local)
npm run eval:api       # also exercise the live Gemini fallback
npm run pack:comis # zip the comis/ folder for distribution
```

## Evaluation (real, measured — not fabricated)
Local parser over 90 labeled commands:

| Metric | Result |
|---|---|
| Exact intent accuracy | **100%** (72/72 `ok` cases) |
| Field precision / recall / F1 | **1.00 / 1.00 / 1.00** |
| Compound-command accuracy | **100%** (9/9) |
| Local coverage (no AI) | **95.6%** |
| Unsupported-request rejection | **100%** |
| Adversarial (prompt-injection) refusal | **100%** |
| Median / p95 parse latency | **0.006 ms / 0.07 ms** |

Live Gemini fallback: median ~700 ms, correctly asks for clarification on unsafe/vague requests. See [EVALUATION.md](EVALUATION.md).

## Offline behavior
The 15 core commands run with no network. If the AI is unreachable, an `AbortController` timeout (4.5 s client / 8 s server) fires, a visible offline banner appears, and you see: *"AI interpretation is unavailable. Common accessibility commands still work locally."*

## Known limitations
- Loading the extension needs Chrome/Edge "Developer mode → Load unpacked" (no Web Store listing was built in 8 hours).
- Some strict-CSP or heavily-scripted SPAs limit content scripts or re-render faster than Simplify re-applies.
- Web Speech **recognition** is Chrome/Edge + HTTPS only; typed input always works. Read-aloud uses `speechSynthesis` where available.
- Simplify heuristics can mis-pick the main content on unusual layouts — **Undo/Reset are always safe**.
- No medical claims. Comis does not diagnose or treat any condition.

See [TESTED_SITES.md](TESTED_SITES.md), [DEMO.md](DEMO.md), and [HACKATHON_PITCH.md](HACKATHON_PITCH.md).

## Future improvements
Chrome Web Store listing · saved per-site profiles · more languages · smarter chart/data-viz color distinction · a background service worker for cross-navigation persistence in SPAs.
