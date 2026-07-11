# Privacy

Comis is built to keep your browsing private. The claims below are the ones the app actually implements — the same list appears in the extension's in-app privacy panel.

## Processed locally — never leaves your browser
- Webpage structure and content simplification
- All visual transformations (text size, spacing, contrast, dark/dim/warm, motion, focus, color distinction, repositioning)
- Read-aloud text extraction (uses your browser's built-in speech synthesis)
- Your saved preferences (`chrome.storage.local`)

## Sent to the AI — only when a command is unusual
When (and only when) the on-device parser can't confidently interpret your wording, the extension sends to the interpretation API:
- Your typed or spoken **command text** (capped at 400 characters)
- Which **adaptations are currently on** (small JSON, capped at 2 KB) — needed for relative commands like "a bit brighter"

Common commands (the 15 core ones) never trigger a network request at all.

## Never sent anywhere
- Page text, headings, article contents, or the DOM
- Passwords or form-field values
- Browsing history or cookies
- Screenshots or images of the page
- Personal account information

## Why this is safe by construction
- The interpretation request contains your command, not the page. There is no code path that reads page text for the model.
- The model returns **structured intent only** and cannot read or exfiltrate anything.
- Speech recognition (when you use voice) uses the browser's Web Speech API; audio handling is the browser's, at the page origin, over HTTPS.

## Data retention
- Preferences live in `chrome.storage.local` on your device until you Reset or remove the extension.
- The API is stateless: it interprets one command and responds. (A best-effort in-memory rate-limit counter keyed by IP exists per server instance and is not persisted.)

## Your controls
- **Undo** reverts the last change; **Reset** removes every Comis change and clears injected state.
- Uninstalling the extension removes all locally stored preferences.
