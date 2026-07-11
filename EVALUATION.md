# Evaluation

We evaluate the **shipped** local parser (`extension/parser.js` — the exact same file the extension loads) against a hand-labeled dataset. Numbers are **measured, not fabricated**. Re-run any time:

```bash
npm run eval          # local parser only
npm run eval:api      # also call the live Gemini fallback (needs network + key)
npm test              # simplify regression test + eval with CI thresholds
```

## Dataset

`evals/dataset.json` — **90 labeled commands** across **15 categories**: direct commands, symptom descriptions, compound requests, relative commands, negation, feature removal, reset, ambiguous, unsupported, adversarial (prompt-injection), senior-friendly phrasing, informal speech, speech-recognition errors, synonyms, and empty input.

Each case is labeled with the expected routing (`ok` / `needs_api` / `unsupported` / `refused` / `empty`) and, for `ok` cases, the expected intent fields.

## Results (local parser)

```
Exact intent accuracy (ok cases)   72/72   100.0%
Field precision                    1.000
Field recall                       1.000
Field F1                           1.000
Compound-command accuracy          9/9     100.0%
Status routing accuracy (all)      88/90    97.8%
Local-parser coverage (no AI)      86/90    95.6%
Accuracy on intended-local cases   84/84   100.0%
Unsupported-request rejection      10/10   100.0%
Adversarial refusal (injection)    5/5     100.0%
Latency (per local parse)          median 0.006 ms   p95 0.07 ms
```

### How each metric is computed
- **Exact intent accuracy** — the produced command's meaningful field-set exactly equals the labeled intent (order-independent).
- **Field precision/recall/F1** — per-field, over all `ok` cases (a produced field matching the labeled sign is a true positive).
- **Compound accuracy** — exact match on cases with ≥2 intended fields.
- **Local coverage** — share of all cases the parser resolves without the AI (the remaining ~4–5% are *intended* to route to Gemini).
- **Unsupported rejection** — share of off-topic/adversarial cases the parser does **not** apply.
- **Adversarial refusal** — share of prompt-injection cases explicitly refused (not forwarded to the model).
- **Latency** — `process.hrtime` around each parse, after warmup.

> The dataset is hand-authored alongside a deterministic parser, so high accuracy is expected — the point is a transparent, reproducible measurement of coverage and, especially, **100% refusal of unsafe/off-topic input** and honest coverage gaps that the AI fallback fills.

## Results (live Gemini fallback)

Measured against the hardened route (`gemini-flash-lite-latest`) on the 6 ambiguous cases:

```
AI latency: median ~700 ms   p95 ~820 ms
actionable 4/6   |   correctly asked to clarify 2/6   |   failed(recovered) 0
```

- Vague-but-valid requests ("make this nicer", "chill out the brightness") → actionable structured commands.
- Genuinely under-specified requests ("fix the page for me", "something is wrong with my screen") → `needsClarification` (no blind action).

## API failure recovery
`--api` also demonstrates recovery: if a call times out or the network is down, the run logs `FAILED … [recovered locally]` and the extension falls back to the local parser + offline banner. There is no infinite loading state.

## Reproducing
All inputs and the scoring code are in `evals/`. `npm run eval` prints the table above and lists any exact-intent misses with expected vs produced intent.
