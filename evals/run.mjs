/**
 * Comis — local parser evaluation.
 *
 * Runs the SHIPPED parser (comis/parser.js) over a labeled dataset and reports
 * real, measured metrics. No numbers are fabricated. AI-fallback cases are only tested
 * live with `--api` (needs network + the deployed endpoint); otherwise they are counted
 * as "routed to AI" and clearly labeled skipped.
 *
 *   node evals/run.mjs            # local parser only
 *   node evals/run.mjs --api      # also exercise the Gemini fallback (network)
 *   node evals/run.mjs --assert   # exit non-zero if below quality thresholds (CI)
 */
import { createRequire } from 'module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const P = require('../comis/parser.js');

const API_URL = process.env.VV_API_URL || 'https://voicevision-eight.vercel.app/api/interpret';
const args = new Set(process.argv.slice(2));
const RUN_API = args.has('--api');
const ASSERT = args.has('--assert');

const { cases } = JSON.parse(fs.readFileSync(new URL('./dataset.json', import.meta.url)));

const KEYS = ['textScale', 'lineSpacing', 'letterSpacing', 'paraSpacing', 'boldText', 'highContrast', 'darkMode', 'dimOverlay', 'warmTone', 'reduceMotion', 'focusHighlight', 'simplify', 'reposition', 'colorDistinction', 'readAloud', 'colorMode', 'hemianopia', 'zoom', 'blur', 'brightness'];

function sign(key, v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (key === 'textScale') return v > 1 ? '+' : '-';
    if (key === 'lineSpacing' || key === 'letterSpacing' || key === 'paraSpacing') return v > 0 ? '+' : '-';
    return 'set';
  }
  return v;
}
function producedSigns(cmd) {
  const o = {};
  if (!cmd) return o;
  for (const k of KEYS) { const s = sign(k, cmd[k]); if (s !== undefined) o[k] = s; }
  if (cmd.reset) o.reset = true;
  if (cmd.undo) o.undo = true;
  if (cmd.find) o.find = 'set';
  return o;
}
// Order-independent comparison of two sign maps.
const canon = (o) => JSON.stringify(Object.keys(o).sort().reduce((m, k) => { m[k] = o[k]; return m; }, {}));
const eq = (a, b) => canon(a) === canon(b);

// ---- Run parser over every case ----
let statusCorrect = 0;
let exactCorrect = 0, okTotal = 0;
let TP = 0, FP = 0, FN = 0;
let compoundCorrect = 0, compoundTotal = 0;
let localResolved = 0;
let unsupTotal = 0, unsupRejected = 0;
let advTotal = 0, advRefused = 0;
const latencies = [];
const misses = [];

// latency warmup
for (let i = 0; i < 200; i++) P.parse('make the text bigger', null);

for (const c of cases) {
  const t0 = process.hrtime.bigint();
  const r = P.parse(c.text, null);
  const t1 = process.hrtime.bigint();
  latencies.push(Number(t1 - t0) / 1e6);

  if (r.status === c.status) statusCorrect++;
  if (r.status !== 'needs_api') localResolved++;

  if (c.status === 'unsupported' || c.status === 'refused') {
    unsupTotal++;
    if (r.status !== 'ok') unsupRejected++;
  }
  if (c.category === 'adversarial') { advTotal++; if (r.status === 'refused') advRefused++; }

  if (c.status === 'ok') {
    okTotal++;
    const expected = c.keys || {};
    const produced = producedSigns(r.command);
    const exact = eq(produced, expected);
    if (exact) exactCorrect++; else misses.push({ text: c.text, cat: c.category, expected, produced, status: r.status });
    const keys = new Set([...Object.keys(expected), ...Object.keys(produced)]);
    for (const k of keys) {
      const e = expected[k], p = produced[k];
      if (e !== undefined && e === p) TP++;
      if (e !== undefined && e !== p) FN++;
      if (p !== undefined && p !== e) FP++;
    }
    if (Object.keys(expected).length >= 2) { compoundTotal++; if (exact) compoundCorrect++; }
  }
}

latencies.sort((a, b) => a - b);
const pct = (arr, p) => arr[Math.min(arr.length - 1, Math.floor((p / 100) * arr.length))];
const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
const precision = TP / (TP + FP || 1);
const recall = TP / (TP + FN || 1);
const f1 = (2 * precision * recall) / (precision + recall || 1);

const localExpected = cases.filter((c) => c.status !== 'needs_api');
const localStatusCorrect = localExpected.filter((c) => P.parse(c.text, null).status === c.status).length;

// ---- Report ----
const pctStr = (n, d) => `${((n / (d || 1)) * 100).toFixed(1)}%`;
console.log('\n=== Comis — Local Parser Evaluation ===');
console.log(`Dataset: ${cases.length} labeled commands across ${new Set(cases.map((c) => c.category)).size} categories\n`);
console.log(`Exact intent accuracy (ok cases)   ${exactCorrect}/${okTotal}   ${pctStr(exactCorrect, okTotal)}`);
console.log(`Field precision                    ${precision.toFixed(3)}`);
console.log(`Field recall                       ${recall.toFixed(3)}`);
console.log(`Field F1                           ${f1.toFixed(3)}`);
console.log(`Compound-command accuracy          ${compoundCorrect}/${compoundTotal}   ${pctStr(compoundCorrect, compoundTotal)}`);
console.log(`Status routing accuracy (all)      ${statusCorrect}/${cases.length}   ${pctStr(statusCorrect, cases.length)}`);
console.log(`Local-parser coverage (no AI)      ${localResolved}/${cases.length}   ${pctStr(localResolved, cases.length)}`);
console.log(`Accuracy on intended-local cases   ${localStatusCorrect}/${localExpected.length}   ${pctStr(localStatusCorrect, localExpected.length)}`);
console.log(`Unsupported-request rejection      ${unsupRejected}/${unsupTotal}   ${pctStr(unsupRejected, unsupTotal)}`);
console.log(`Adversarial refusal (injection)    ${advRefused}/${advTotal}   ${pctStr(advRefused, advTotal)}`);
console.log(`\nLatency (per local parse):  median ${pct(latencies, 50).toFixed(3)} ms   p95 ${pct(latencies, 95).toFixed(3)} ms   mean ${mean.toFixed(3)} ms`);

if (misses.length) {
  console.log(`\nExact-intent misses (${misses.length}):`);
  for (const m of misses) console.log(`  [${m.cat}] "${m.text}" -> exp ${JSON.stringify(m.expected)} got ${JSON.stringify(m.produced)} (${m.status})`);
}

// ---- Optional live AI fallback test ----
async function runApi() {
  const apiCases = cases.filter((c) => c.status === 'needs_api');
  console.log(`\n=== Gemini fallback (live) — ${apiCases.length} ambiguous cases ===`);
  const lat = [];
  let actionable = 0, failed = 0;
  for (const c of apiCases) {
    const t0 = Date.now();
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript: c.text }), signal: ctrl.signal });
      clearTimeout(to);
      const body = await res.json();
      lat.push(Date.now() - t0);
      const isAction = !body.error && !body.needsClarification;
      if (isAction) actionable++;
      console.log(`  "${c.text}" -> ${res.status} ${body.needsClarification ? '(clarify)' : body.error ? '(' + body.error + ')' : '(actionable)'}  ${Date.now() - t0}ms`);
    } catch (e) {
      failed++;
      console.log(`  "${c.text}" -> FAILED (${e.name === 'AbortError' ? 'timeout' : 'network'}) [recovered locally]`);
    }
  }
  if (lat.length) { lat.sort((a, b) => a - b); console.log(`\n  AI latency: median ${pct(lat, 50)}ms  p95 ${pct(lat, 95)}ms  |  actionable ${actionable}/${apiCases.length}  |  failed(recovered) ${failed}`); }
  else console.log('  All AI calls failed — local fallback still covers common commands.');
}

async function main() {
  if (RUN_API) await runApi();
  else console.log('\n(AI-fallback cases routed to Gemini were not called. Run `node evals/run.mjs --api` to test them live.)');

  if (ASSERT) {
    const okExact = exactCorrect / (okTotal || 1);
    const failChecks = [];
    if (okExact < 0.85) failChecks.push(`exact intent ${(okExact * 100).toFixed(1)}% < 85%`);
    if (advTotal && advRefused < advTotal) failChecks.push('adversarial refusal < 100%');
    if (localStatusCorrect / localExpected.length < 0.9) failChecks.push('intended-local accuracy < 90%');
    if (failChecks.length) { console.error('\nASSERT FAILED: ' + failChecks.join('; ')); process.exit(1); }
    console.log('\nASSERT PASSED.');
  }
}
main();
