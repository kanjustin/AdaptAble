# Architecture

Comis is a **hybrid interpretation system**, not a thin LLM wrapper. The model is only one optional stage, and it can never touch the DOM.

```
┌─────────────┐   transcript / typed text
│ Popup (UI)  │──────────────┐
│ brain       │              ▼
└─────────────┘     ┌───────────────────────┐  confident (status=ok)
      ▲             │ Local parser (UMD)    │────────────────────────────┐
      │ state/trace │ comis/parser.js   │                            │
      │             └───────────┬───────────┘                            │
      │                         │ ambiguous (needs_api)                  │
      │                         ▼                                        ▼
      │             ┌───────────────────────┐  Zod .strict()  ┌────────────────────────┐
      │             │ POST /api/interpret   │──validate──────►│ Content script (hands) │
      │             │ Gemini → structured   │  reject unknown │ engine + Simplify      │
      │             │ intent ONLY           │  keys / values  │ predefined actions     │
      │             └───────────────────────┘                 └────────────┬───────────┘
      │                                                                     │
      └──────────────────────── chrome.runtime messaging ──────────────────┘
```

## Components

| File | Role |
|---|---|
| `comis/parser.js` | **Local deterministic parser** (UMD). Ordered rule set → structured command. Rejects prompt-injection, routes ambiguous wording to the AI, refuses off-topic input. Shared verbatim with the eval harness. |
| `comis/simplify.js` | **Simplify Page.** Deterministic main-content extraction + reversible declutter. Exposes `window.__VV_SIMPLIFY`. |
| `comis/content.js` | **Action engine ("hands").** Typed state, undo stack, all predefined DOM/CSS transforms, TTS, MutationObserver for dynamic pages, full teardown. Only applies commands; never interprets. |
| `comis/popup.{html,js}` | **Control surface ("brain").** Assist/Simulation tabs, local-parser-first pipeline, API call with timeout, client-side command sanitization, transparency trace, privacy panel, debug metrics, offline banner. |
| `src/lib/assist/schema.ts` | **Strict Zod command schema** (source of validation truth, server-side). |
| `src/app/api/interpret/route.ts` | **Gemini fallback.** Assist-first prompt, Zod validation, timeout, rate limit, CORS lock, size caps. |
| `public/demo.html` | Cluttered demo page (same engine runs here and on real sites). |
| `evals/` | Labeled dataset + measured metrics runner. |
| `tests/` | jsdom regression test for Simplify. |

## State model

One typed `AssistState` object holds all adaptations (assist + simulation keys). Design properties:

- **Serialization / persistence** — stored in `chrome.storage.local`, synced across tabs via `onChanged`.
- **Undo history** — a bounded stack (25) of prior state snapshots; every applied command pushes one.
- **Reset** — restores default state and tears down every injected artifact (styles, overlays, `data-vv-*` attributes, reader containers, observers, speech, highlighting, repositioning, labels).
- **Idempotence** — commands merge by key with nullish semantics (`null` = untouched, `false` = turn off, value = set). Enabling dark mode twice yields the same state.
- **Migration/versioning** — new assist keys were added additively on top of the original `FilterState` keys, so persisted state upgrades cleanly.

## Command flow (why it's trustworthy)

1. Popup gets a transcript (mic port or typed input).
2. `VVParser.parse()` runs first — instant, offline, deterministic.
3. If confident → send the command to the content script. If ambiguous → call `/api/interpret`.
4. The model returns **only** a structured command; the server validates it with `CommandSchema.strict()`; the client re-sanitizes against an enum/type whitelist.
5. The content script maps the command to **predefined** transforms. No model string is ever executed as code, CSS, or a selector.
6. The explanation shown to the user is generated **deterministically** from the validated command (`VVParser.describe`), not from the model's free-form text.

## Performance

- Local parse: ~0.006 ms median (measured).
- Simplify: one main-content scan on command, then a debounced (400 ms) MutationObserver only while active; observer disconnects during its own writes to avoid loops, and reconnects after.
- CSS-only assist toggles are composed into a single regenerated stylesheet to avoid repeated DOM churn.
- Everything cleans up on Reset (observers, overlays, speech, styles).
