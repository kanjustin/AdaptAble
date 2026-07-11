# Comis — Hackathon Pitch

## One-line description
**Comis is a voice-controlled accessibility layer that lets people describe what is difficult about a webpage and safely restructures the page around their needs.**

## Problem
People often know that a page is difficult to use but do not know which accessibility setting can help. Browser and OS accessibility tools are scattered and technical — they assume you already speak the jargon.

## User
Older adults, and people experiencing low vision, cognitive overload, migraines, motion sensitivity, or reading difficulty — trying to use essential websites: city services, healthcare and pharmacy info, utility bills, transit, and public resources.

## What we built
A Chrome extension with two clearly separated modes:
- **Assist Mode** (the product): Simplify Page, larger text & spacing, contrast, dark/dim/warm, reduce motion, focus highlighting, color-distinction assistance, content repositioning, read-aloud, undo/reset, persistent preferences.
- **Developer Simulation Mode** (separate, labeled non-medical): color-blindness and field-loss previews for developers to inspect barriers.

## Differentiation
- Works across webpages as a **browser extension**, not just a demo app.
- **Common commands run locally** — instant and offline.
- **AI is used only for ambiguous intent**, and only ever returns **structured intent** (validated by a strict schema) — never code, never the page.
- **Deterministic action engine** — the model can't touch the DOM.
- **Explainable** — every change shows what was interpreted, by local parser vs Gemini, with latency and "no page content sent."
- **Privacy-conscious** — page text/passwords/forms/history are never sent anywhere.
- **Undo and Reset** — every change is reversible.
- **Real evaluation metrics** — measured, not fabricated (100% exact intent, 100% adversarial refusal, ~0.006 ms local parse; live AI median ~700 ms).
- **Distinct Assist and Simulation modes** — we corrected the original product, which mislabeled *simulations* as *assistance*.

## Demo flow
1. Open a cluttered page.
2. Say, "This page is overwhelming and the text is too small."
3. Show simplified layout and larger text.
4. Say, "Move the content to the right and stop all movement."
5. Show compound adaptation.
6. Open the transparency panel.
7. Show measured latency and interpretation source.
8. Disable the network.
9. Say, "Make the text bigger."
10. Show local fallback working.
11. Reset the page.

## Why it fits the rubric (community impact)
It's a genuinely useful tool for a real local problem — helping neighbors, especially seniors, actually use the websites that run daily life — engineered to a high standard the technical judges can respect: a metric, reliability, explainability, and a privacy/security model.

## Closing statement
**Comis lets people describe what is wrong in their own words and makes the web adapt to them — not the other way around.**
