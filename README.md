# VoiceVision

Voice-activated screen accessibility for people with visual impairments. Speak your needs — VoiceVision adapts your display in real time.

Built at AI Hackathon with The AI Collective Tri-Valley | Humans in AI Week, June 7, 2026.

---

## Setup (5 minutes)

### 1. Clone and install

```bash
git clone <your-repo-url>
cd voicevision
npm install
```

### 2. Get your free API key

Go to **https://aistudio.google.com/apikey** — log in with Google, create a key.  
No credit card. No billing. Free tier: 1,500 requests/day.

### 3. Set your key

```bash
cp .env.example .env.local
# Edit .env.local — paste your key as GEMINI_API_KEY=AIza...
```

### 4. Run

```bash
npm run dev
```

Open **http://localhost:3000** in **Chrome or Edge** (required for voice).

---

## Deploy to Vercel (free)

```bash
npm i -g vercel
vercel
```

Add `GEMINI_API_KEY` in the Vercel dashboard under Project → Settings → Environment Variables.  
Or connect your GitHub repo at vercel.com/dashboard for auto-deploy on push.

---

## Voice Commands

| You say | What happens |
|---|---|
| "I have red-green colorblindness" | Deuteranopia filter |
| "Make it dark" | Dark mode |
| "Too bright in here" | Dark mode + reduced brightness |
| "High contrast please" | Contrast boost |
| "I'm light sensitive" | Dark mode + warm tone |
| "Macular degeneration" | Center magnification |
| "Reset to normal" | All filters cleared |

Commands stack. Say "dark mode" then "high contrast" and both apply.

---

## Stack

- **Next.js 14+** App Router, TypeScript
- **Web Speech API** — browser native, free, no signup
- **Google Gemini 2.5 Flash** — interprets natural language into commands (free tier)
- **SVG feColorMatrix** — clinically accurate color blindness simulation
- **Tailwind CSS**
- **Vercel** — free Hobby tier, HTTPS included

---

## Browser Support

**Works:** Chrome 25+, Edge (Chromium)  
**Partial:** Safari (iOS 14.5+)  
**No:** Firefox  

Run the demo in Chrome.

---

## For AI Coding Assistants

Read `CLAUDE.md` (Claude Code) or `AGENTS.md` (Cursor, Windsurf, Copilot) for full context.  
Read `SKILLS.md` for copy-pasteable implementations of every major component.  
Architecture decisions, exact filter values, and API design are all documented.
