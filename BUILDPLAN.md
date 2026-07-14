# AdaptAble — 90-Minute Build Plan

Build window: **11:40 AM – 1:10 PM, June 7, 2026**

Drop all files from this repo into a new GitHub repo at 11:40 AM.
Run `npx create-next-app@latest voicevision --typescript --tailwind --app` or clone a blank Next.js starter.
Copy CLAUDE.md, AGENTS.md, PRD.md, README.md, .env.example into root.
Open with Claude Code or Cursor. Start first commit.

---

## T+0:00 — T+0:15 | Scaffold (15 min)

**Goal:** Running Next.js app, env wired, no errors.

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-git
git init && git add . && git commit -m "init: Next.js scaffold"
cp .env.example .env.local
# Add GEMINI_API_KEY to .env.local
npm install @google/genai
npm run dev
```

Create the type definition:
- `src/types/index.ts` — `AccessibilityCommand` interface (exact schema from AGENTS.md)

First commit after scaffold works.

---

## T+0:15 — T+0:30 | API Route + Claude (15 min)

**Goal:** POST /api/interpret returns valid command JSON.

Build:
- `src/app/api/interpret/route.ts` — use exact system prompt and model from AGENTS.md
- Test with curl or a quick fetch in browser console

```bash
curl -X POST http://localhost:3000/api/interpret \
  -H "Content-Type: application/json" \
  -d '{"transcript": "make it dark mode"}'
# Should return JSON with darkMode: true
```

Commit: `feat: Claude API route working`

---

## T+0:30 — T+0:50 | Voice Input + Filters (20 min)

**Goal:** Voice captured, sent to API, filters visible on screen.

Build in this order:
1. `src/components/FilterOverlay.tsx` — hidden SVG with all 3 color matrix defs
2. Add FilterOverlay to `src/app/layout.tsx`
3. `src/lib/filters.ts` — `buildFilterString` and `applyFilters` functions
4. `src/hooks/useSpeechRecognition.ts` — Web Speech API hook
5. `src/components/VoiceButton.tsx` — button that triggers hook, POSTs transcript, calls applyFilters

At this point: speak "make it dark" → dark mode should apply.

Commit: `feat: voice → Claude → filter pipeline working`

---

## T+0:50 — T+1:05 | Test Panel + UI Polish (15 min)

**Goal:** Demo-ready UI that makes filter effects visually obvious.

Build:
- Test content panel in page.tsx:
  - Color swatches (red, green, blue, orange, yellow, purple)
  - A colorful image from `https://picsum.photos/400/200?random=1`
  - Sample text block
  - Gradient bar
- `src/components/ActiveModes.tsx` — shows active filters as badges
- `src/components/CommandHistory.tsx` — last 3 commands with Claude's explanation
- Transcript display showing what was heard

Commit: `feat: demo UI with test panel and active mode display`

---

## T+1:05 — T+1:20 | All Modes + Edge Cases (15 min)

**Goal:** All 6+ modes work, reset works, stacking works.

Test each voice command manually:
- [ ] "I have red-green colorblindness" → deuteranopia
- [ ] "Protanopia" → protanopia
- [ ] "Make it dark" → dark mode
- [ ] "High contrast" → contrast boost
- [ ] "I'm light sensitive" → dark + warm
- [ ] "Reset to normal" → clear all

Fix any bugs. Test stacking ("dark mode" then "high contrast").

Commit: `feat: all modes verified, reset and stacking working`

---

## T+1:20 — T+1:30 | Deploy (10 min)

```bash
# Push to GitHub
git remote add origin https://github.com/yourusername/voicevision.git
git push -u origin main

# Deploy to Vercel
vercel --prod
# OR: connect repo in vercel.com/dashboard → auto-deploys on push
# Add GEMINI_API_KEY in Vercel env vars
```

Test the live URL on Chrome. Confirm voice works on HTTPS.

Final commit: `feat: production deploy verified`

---

## If Running Behind

**Drop if short on time (in order):**
1. CommandHistory component — just show active modes
2. Warm tone and tritanopia filters — keep deuteranopia, protanopia, dark, high contrast, reset
3. Explanation text display — still log to console

**Never drop:**
- The voice → Claude → filter pipeline (core demo)
- Deuteranopia filter (most common, most visual)
- Dark mode
- Reset command
- The test content panel (judges need to see the effect)

---

## Demo Talking Points

When presenting (1:30–1:45 PM):

1. "Most accessibility tools require navigating menus and knowing technical terms. AdaptAble lets you describe your experience in plain language."

2. Live demo: "I have red-green colorblindness" → point out the color swatch panel changing

3. "Claude isn't doing keyword matching. It understands medical terminology, symptom descriptions, and compound requests."

4. "The AI layer is a thin intent parser — fast, cheap, accurate. Each call costs less than a tenth of a cent."

5. "This could run as a browser extension, a system overlay, or be embedded in any web app. The demo shows the concept working end-to-end."
