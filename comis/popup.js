/**
 * Comis — popup orchestration (the "brain").
 *
 * Flow: transcript → local parser (instant, offline) → if not confident, the Gemini
 * API (with a hard AbortController timeout) → validate/sanitize → send a predefined
 * command to the content script. The API only ever receives the command text and the
 * current adaptation state — never page content. All dynamic text is rendered with
 * textContent (no innerHTML) to prevent injection into the popup UI.
 */
'use strict';

// Default to the deployed API. Override for a local demo without editing code:
//   chrome.storage.local.set({ vvApiUrl: 'http://localhost:3000/api/interpret' })
// (run `npm run dev` first). Common commands never hit this — only ambiguous wording.
let API_URL = 'https://voicevision-eight.vercel.app/api/interpret';
const API_TIMEOUT_MS = 4500;

const $ = (id) => document.getElementById(id);
const micBtn = $('micBtn');
const textInput = $('textInput');

let lastResponse = null;
let activePort = null;
let currentMode = 'assist';

// ---- Small DOM helpers (all text via textContent) -------------------------
function setStatus(t) { $('status').textContent = t || ''; }
function setTranscript(t) { $('transcript').textContent = t || ''; }
function setMetric(id, v) { const el = $(id); if (el) el.textContent = v; }

// ---- Client-side command validation (defense in depth vs the API) ---------
const ENUMS = {
  colorMode: ['deuteranopia', 'protanopia', 'tritanopia', 'achromatopsia'],
  hemianopia: ['left', 'right'],
  zoom: ['center', 'peripheral', 'full'],
  reposition: ['left', 'right', 'center'],
  readAloud: ['start', 'stop', 'pause', 'resume'],
};
const BOOL_KEYS = ['darkMode', 'highContrast', 'warmTone', 'invertColors', 'blur', 'dimOverlay', 'boldText', 'reduceMotion', 'focusHighlight', 'simplify', 'colorDistinction'];
const NUM_KEYS = { brightness: [0.1, 1.5], textScale: [1, 2.5], lineSpacing: [0, 2.6], letterSpacing: [0, 0.2], paraSpacing: [0, 3] };

function sanitizeCommand(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const c = { reset: raw.reset === true, undo: raw.undo === true };
  for (const [k, vals] of Object.entries(ENUMS)) {
    if (vals.includes(raw[k])) c[k] = raw[k];
  }
  for (const k of BOOL_KEYS) {
    if (raw[k] === true || raw[k] === false) c[k] = raw[k];
  }
  for (const [k, [lo, hi]] of Object.entries(NUM_KEYS)) {
    const v = raw[k];
    if (typeof v === 'number' && isFinite(v)) c[k] = Math.min(hi, Math.max(lo, v));
  }
  if (typeof raw.find === 'string' && raw.find.trim()) c.find = raw.find.slice(0, 120);
  if (raw.intensities && typeof raw.intensities === 'object') {
    const it = {};
    for (const [k, v] of Object.entries(raw.intensities)) {
      if (typeof v === 'number' && isFinite(v)) it[k] = Math.min(1, Math.max(0, v));
    }
    if (Object.keys(it).length) c.intensities = it;
  }
  return c;
}

// ---- Messaging with the content script ------------------------------------
async function sendToActiveTab(message) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  try { return await chrome.tabs.sendMessage(tab.id, message); }
  catch { return null; } // no content script (chrome://, store pages, etc.)
}

// ---- API call with hard timeout -------------------------------------------
async function callApi(text, state) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: text.slice(0, 400), currentState: state || null }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error || `AI error (${res.status})` };
    return { ok: true, command: body };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, error: e.name === 'AbortError' ? 'timeout' : 'network' };
  }
}

// ---- Interpretation pipeline ----------------------------------------------
async function interpret(text) {
  text = (text || '').trim();
  setTranscript(text ? `“${text}”` : '');
  if (!text) { setStatus('Please say or type an accessibility request.'); return; }

  const t0 = performance.now();
  const r = VVParser.parse(text, lastResponse && lastResponse.state);
  const localMs = performance.now() - t0;
  setMetric('mLocal', localMs.toFixed(1) + ' ms');
  setMetric('mApi', '—'); setMetric('mDom', '—');

  if (r.status === 'refused') {
    setStatus('🛡️ ' + r.explanation);
    updateTrace({ said: text, interpreted: r.explanation, source: 'local', confidence: r.confidence, total: localMs });
    return;
  }
  if (r.status === 'unsupported') {
    setStatus(r.explanation);
    updateTrace({ said: text, interpreted: r.explanation, source: 'local', confidence: r.confidence, total: localMs });
    return;
  }
  if (r.status === 'ok') {
    await applyCommand(r.command, { source: 'local', confidence: r.confidence, said: text, interpreted: r.explanation, localMs, apiMs: 0 });
    return;
  }

  // needs_api
  if (!navigator.onLine) {
    setStatus('AI interpretation is unavailable (offline). Common commands still work locally.');
    updateTrace({ said: text, interpreted: 'Needed AI, but offline.', source: 'local', total: localMs });
    return;
  }
  setStatus('Interpreting with AI…');
  const a0 = performance.now();
  const api = await callApi(text, lastResponse && lastResponse.state);
  const apiMs = performance.now() - a0;
  setMetric('mApi', apiMs.toFixed(0) + ' ms');

  if (!api.ok) {
    const msg = api.error === 'timeout'
      ? 'AI timed out. Common commands still work locally — try simpler wording.'
      : api.error === 'network'
        ? 'Could not reach the AI. Common commands still work locally.'
        : api.error;
    setStatus(msg);
    updateTrace({ said: text, interpreted: msg, source: 'gemini', total: localMs + apiMs });
    return;
  }

  const command = sanitizeCommand(api.command);
  if (!command || (VVParser.isEmptyCommand(command) && !command.reset && !command.undo)) {
    setStatus('I couldn’t map that to an adaptation. Try “make the text bigger” or “simplify this page.”');
    updateTrace({ said: text, interpreted: (api.command && api.command.explanation) || 'No actionable adaptation.', source: 'gemini', total: localMs + apiMs });
    return;
  }
  const interpreted = VVParser.describe(command);
  await applyCommand(command, { source: 'gemini', confidence: command.confidence, said: text, interpreted, localMs, apiMs });
}

async function applyCommand(command, meta) {
  const d0 = performance.now();
  const resp = await sendToActiveTab({ type: 'APPLY_COMMAND', command });
  const domMs = performance.now() - d0;
  setMetric('mDom', domMs.toFixed(0) + ' ms');
  const total = (meta.localMs || 0) + (meta.apiMs || 0) + domMs;
  setMetric('mTotal', total.toFixed(0) + ' ms');
  setMetric('mSource', meta.source === 'local' ? 'Local parser' : 'Gemini');

  if (!resp) {
    setStatus('This page can’t be adapted (e.g. a chrome:// or store page). Open a normal website.');
    return;
  }
  lastResponse = resp;
  render(resp);
  let interpreted = meta.interpreted;
  if (command.simplify && resp.lastSimplify) {
    interpreted += resp.lastSimplify.ok ? ` (hid ${resp.lastSimplify.hidden} surrounding blocks)` : ' (no obvious main content found)';
  }
  if (command.find) {
    const f = resp.lastFind || {};
    interpreted = f.ok
      ? `Found “${f.label || command.find}” — highlighted${f.guided ? ' and pointed to the control to click' : ' and scrolled to it'}.`
      : `Couldn't find “${command.find}” on this page — try different words.`;
  }
  setStatus('✓ ' + interpreted);
  if (resp.reading) showReadCtl(true);
  updateTrace({ ...meta, interpreted, total });
}

// ---- Trace (explainability) -----------------------------------------------
function updateTrace(info) {
  const box = $('trace');
  box.textContent = '';
  const add = (label, valueNode) => {
    const row = document.createElement('div');
    const b = document.createElement('b'); b.textContent = label + ': ';
    row.appendChild(b);
    if (typeof valueNode === 'string') row.appendChild(document.createTextNode(valueNode));
    else row.appendChild(valueNode);
    box.appendChild(row);
  };
  const pill = (text, cls) => { const s = document.createElement('span'); s.className = 'pill ' + cls; s.textContent = text; return s; };
  add('You said', info.said ? `“${info.said}”` : '(nothing)');
  add('Comis interpreted', info.interpreted || '—');
  add('Interpreted by', pill(info.source === 'local' ? 'Local parser' : 'Gemini', info.source === 'local' ? 'local' : 'gemini'));
  if (typeof info.confidence === 'number') add('Confidence', Math.round(info.confidence * 100) + '%');
  if (typeof info.total === 'number') add('Processing time', info.total.toFixed(0) + ' ms');
  add('Page contents sent externally', pill('No', 'no'));
  $('traceBox').open = true;
}

// ---- Rendering active state -----------------------------------------------
function render(resp) {
  lastResponse = resp;
  renderChips('adaptations', resp.adaptations, resp.state);
  renderChips('simulations', resp.simulations, resp.state);
  $('undoBtn').disabled = !resp.canUndo;
  $('undoBtn').style.opacity = resp.canUndo ? '1' : '0.5';
  if (!resp.reading) showReadCtl(false);
}

function renderChips(containerId, items, state) {
  const container = $(containerId);
  container.textContent = '';
  if (!items || !items.length) {
    const span = document.createElement('span');
    span.className = 'empty';
    span.textContent = containerId === 'adaptations' ? 'None yet — try a quick action above.' : 'None active.';
    container.appendChild(span);
    return;
  }
  for (const item of items) {
    const chip = document.createElement('div');
    chip.className = 'chip';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = item.label;
    chip.appendChild(name);
    if (item.intensityKey && state) {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = '0'; slider.max = '1'; slider.step = '0.05';
      slider.value = String((state.intensities && state.intensities[item.intensityKey]) ?? 1);
      slider.addEventListener('change', async () => {
        const resp = await sendToActiveTab({ type: 'SET_INTENSITY', key: item.intensityKey, value: parseFloat(slider.value) });
        if (resp) render(resp);
      });
      chip.appendChild(slider);
    }
    const x = document.createElement('button');
    x.className = 'x'; x.title = 'Turn off'; x.textContent = '×';
    x.addEventListener('click', async () => {
      const resp = await sendToActiveTab({ type: 'TOGGLE_FILTER', key: item.key });
      if (resp) { lastResponse = resp; render(resp); }
    });
    chip.appendChild(x);
  }
}

function showReadCtl(show) { $('readCtl').classList.toggle('show', show); }

// ---- Voice input (recognition runs in the content script) -----------------
async function startListening() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) { setStatus('Open a normal webpage to use voice.'); return; }
  let port;
  try { port = chrome.tabs.connect(tab.id, { name: 'voicevision-mic' }); }
  catch { setStatus('Open a normal webpage (not chrome://) to use voice.'); return; }
  activePort = port;

  port.onDisconnect.addListener(() => {
    activePort = null; micReset();
    if (chrome.runtime.lastError) setStatus('Open a normal https:// webpage to use voice.');
  });
  port.onMessage.addListener((msg) => {
    if (msg.type === 'start') { micBtn.classList.add('listening'); micBtn.textContent = '⏺'; setStatus('Listening…'); return; }
    if (msg.type === 'end') { activePort = null; micReset(); return; }
    if (msg.type === 'result') { interpret(msg.transcript); return; }
    if (msg.type === 'error') {
      micReset();
      if (msg.error === 'unsupported') setStatus('Voice isn’t supported here. Type your request instead.');
      else if (msg.error === 'not-allowed' || msg.error === 'service-not-allowed') setStatus('Microphone blocked. Allow mic for this site, or type your request.');
      else setStatus('Mic error: ' + msg.error);
    }
  });
  port.postMessage({ type: 'START' });
}
function micReset() { micBtn.classList.remove('listening'); micBtn.textContent = '🎤'; }

// ---- Wiring ----------------------------------------------------------------
micBtn.addEventListener('click', () => {
  if (activePort) { activePort.postMessage({ type: 'STOP' }); activePort.disconnect(); activePort = null; micReset(); return; }
  startListening();
});
$('sendBtn').addEventListener('click', () => { interpret(textInput.value); textInput.value = ''; });
textInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { interpret(textInput.value); textInput.value = ''; } });

document.querySelectorAll('[data-cmd]').forEach((btn) => {
  btn.addEventListener('click', () => interpret(btn.getAttribute('data-cmd')));
});
document.querySelectorAll('[data-sim]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    let cmd;
    try { cmd = JSON.parse(btn.getAttribute('data-sim')); } catch { return; }
    const resp = await sendToActiveTab({ type: 'APPLY_COMMAND', command: cmd });
    if (resp) { lastResponse = resp; render(resp); }
  });
});

$('findBtn').addEventListener('click', () => {
  textInput.value = 'find ';
  textInput.focus();
  setStatus('Type what to find on the page (e.g. “the return policy”), then press Enter.');
});
$('readBtn').addEventListener('click', async () => {
  const resp = await sendToActiveTab({ type: 'READ_ALOUD', action: 'start' });
  if (resp) { lastResponse = resp; render(resp); showReadCtl(true); setStatus(resp.reading ? '🔊 Reading the main content aloud…' : 'Nothing readable found on this page.'); }
});
$('readPause').addEventListener('click', () => sendToActiveTab({ type: 'READ_ALOUD', action: 'pause' }));
$('readResume').addEventListener('click', () => sendToActiveTab({ type: 'READ_ALOUD', action: 'resume' }));
$('readStop').addEventListener('click', async () => { await sendToActiveTab({ type: 'READ_ALOUD', action: 'stop' }); showReadCtl(false); setStatus('Stopped reading.'); });

$('undoBtn').addEventListener('click', async () => { const resp = await sendToActiveTab({ type: 'UNDO' }); if (resp) { lastResponse = resp; render(resp); setStatus('↩ Undid the last change.'); } });
const doReset = async () => { const resp = await sendToActiveTab({ type: 'RESET' }); if (resp) { lastResponse = resp; render(resp); setStatus('⟲ Page reset to normal.'); showReadCtl(false); } };
$('resetBtn').addEventListener('click', doReset);
$('resetBtn2').addEventListener('click', doReset);

$('privacyBtn').addEventListener('click', () => {
  const p = $('privacyPanel'); const show = !p.classList.contains('show');
  p.classList.toggle('show', show);
});

// Tabs
function setMode(mode) {
  currentMode = mode;
  const assist = mode === 'assist';
  $('tabAssist').setAttribute('aria-selected', String(assist));
  $('tabSim').setAttribute('aria-selected', String(!assist));
  $('assistView').style.display = assist ? '' : 'none';
  $('simView').style.display = assist ? 'none' : '';
  chrome.storage.local.set({ vvMode: mode });
}
$('tabAssist').addEventListener('click', () => setMode('assist'));
$('tabSim').addEventListener('click', () => setMode('sim'));

// Offline indicator
function refreshOnline() { $('offlineBanner').style.display = navigator.onLine ? 'none' : 'block'; }
window.addEventListener('online', refreshOnline);
window.addEventListener('offline', refreshOnline);

// ---- Init ------------------------------------------------------------------
(async function init() {
  refreshOnline();
  chrome.storage.local.get(['vvMode', 'vvApiUrl'], (d) => {
    setMode(d && d.vvMode === 'sim' ? 'sim' : 'assist');
    if (d && typeof d.vvApiUrl === 'string' && /^https?:\/\//.test(d.vvApiUrl)) API_URL = d.vvApiUrl;
  });
  const resp = await sendToActiveTab({ type: 'GET_STATE' });
  if (resp) render(resp);
  else setStatus('Open a normal webpage, then reopen Comis to adapt it.');
})();
