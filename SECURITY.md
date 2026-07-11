# Security model

Comis is designed so that **the language model can never cause a harmful action**, and the extension asks for the **minimum** access it needs.

## Threat model & mitigations

| Risk | Mitigation |
|---|---|
| Model tricked into running code / CSS / selectors | The command schema has **no field** for code, CSS, selectors, URLs, or scripts. The content script only maps validated intent to **predefined** transforms. Nothing model-supplied is executed. |
| Prompt injection (from the user or, hypothetically, page text) | Page content is **never sent to the model** — only the command text + current settings. The local parser refuses injection patterns outright (`ignore previous…`, `run script`, `reveal api key`, `<script`, `eval(`, …). 100% refusal on our adversarial eval set. |
| Malformed / hostile model output | Server validates with **Zod `.strict()`**: unknown keys rejected, every number bounded, enums closed. Invalid output → safe `needsClarification`, no DOM change. The client re-sanitizes against a type/enum whitelist (defense in depth). |
| API abused as a free Gemini proxy | **CORS is locked**: only `chrome-extension://*` and the app/localhost origins get their `Origin` echoed; arbitrary websites do not, so their browsers block the response. |
| Request flooding | Per-instance **rate limit** (20 req/min/IP) + **request-size caps** (transcript ≤ 400 chars, state ≤ 2 KB). |
| Runaway/hung model call | **Timeouts**: 4.5 s client `AbortController`, 8 s server `Promise.race`. No infinite spinners. |
| Key leakage | `GEMINI_API_KEY` is **server-side only** (`route.ts`). It is never in client code, the extension, the README, or git. `.env*` is gitignored. |
| UI injection (XSS in popup) | All dynamic text (transcript, explanations, labels) is rendered with `textContent`; no `innerHTML` with untrusted content. |
| Over-broad extension permissions | Manifest V3 with only `activeTab` + `storage`. **No** `host_permissions`, **no** background service worker, **no** remote scripts, **no** `eval`. |

## Manifest V3 posture

```jsonc
"permissions": ["activeTab", "storage"]   // nothing more
"content_scripts": [{ "matches": ["<all_urls>"], "js": ["simplify.js","content.js"] }]
```
- `activeTab` grants access only to the tab the user acts on.
- `storage` persists preferences locally.
- The mic runs in the **content script** (page origin), which can legitimately hold a microphone grant — the `chrome-extension://` popup origin cannot.

## What we intentionally do NOT do
- Do not send page text, forms, passwords, cookies, history, or screenshots anywhere.
- Do not execute model-generated selectors, CSS, or JavaScript.
- Do not inject remote scripts or use `eval`/`new Function` on untrusted input.
- Do not claim to diagnose or treat any medical condition.

## Reporting
This is a hackathon project; for real deployment, add authenticated rate limiting, a durable rate-limit store (the current one is per-serverless-instance and best-effort), and a Chrome Web Store review.
