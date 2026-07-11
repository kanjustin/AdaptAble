# Tested sites & limitations

We do **not** claim universal compatibility. Below is what we exercised and where the honest edges are. The local demo page is the guaranteed-reliable target; real sites vary.

## Verified automatically
| Target | Features | Result |
|---|---|---|
| `public/demo.html` (cluttered city-services page) | Simplify (main-content pick, hide 8 clutter blocks, preserve controls, full teardown) | ✅ `tests/simplify.test.mjs` — 11/11 assertions via jsdom |
| 90-command dataset | Local parser intent + routing + refusal | ✅ `npm run eval` — 100% exact intent, 100% refusal |
| Hardened API route (local) | Gemini interpret, injection→clarify, CORS lock, timeout | ✅ verified with live Gemini |

## Recommended manual demo targets (by page type)
These are page *types* the design targets; behavior depends on each site's markup and CSP:

- **Article / news pages** — Simplify + larger text + read-aloud work well (clear `<article>`/`<main>`).
- **Government / city-service pages** — the primary persona; typically server-rendered semantic HTML, good for Simplify and contrast/dim.
- **Documentation pages** — strong Simplify + spacing results.
- **Healthcare / pharmacy info pages** — reading support (larger text, spacing, read-aloud).
- **Common SPAs** — assist toggles work; Simplify re-applies via a debounced MutationObserver but can lag very fast re-renders.

## Known limitations
- **Load unpacked required** — no Web Store listing was built in the 8-hour window.
- **Strict-CSP sites** — some pages restrict content-script behavior or block the mic; typed input and CSS-based assist toggles still function.
- **JS-heavy SPAs** — main content that re-renders faster than the 400 ms observer debounce may need a re-issue of "Simplify"; Undo/Reset always restore.
- **Unusual layouts** — the content-density heuristic can occasionally mis-pick the main region; Reset is always safe.
- **`chrome://`, Web Store, and other privileged pages** — content scripts can't run there; the popup shows a clear message.
- **Speech recognition** — Chrome/Edge + HTTPS only. Read-aloud needs `speechSynthesis` (most desktop browsers).
- **Text scaling** uses page zoom on the content root for reliability across arbitrary sites; on a few fixed-layout pages this can shift positioned elements (reversible via Undo/Reset).

## How to extend testing
Add a page's URL and observed behavior to this table as you try it. For a new tricky layout, add a fixture to `tests/` mirroring `simplify.test.mjs`.
