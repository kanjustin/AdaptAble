/**
 * End-to-end test of the REAL extension engine (comis/content.js + simplify.js),
 * driven through the actual chrome.runtime message protocol with a mock `chrome` API.
 * Proves the popup -> content-script command flow applies and fully reverts DOM changes.
 *
 * Run: node tests/engine.test.mjs
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../comis/parser.js');

let failures = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) failures++; };

const html = fs.readFileSync('./public/demo.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true });
const { window } = dom;

// jsdom has no layout — stub visibility so the density scoring can run.
window.Element.prototype.getBoundingClientRect = function () {
  const len = (this.textContent || '').length;
  return { width: 800, height: Math.max(10, Math.min(len, 2000)), top: 0, left: 0, right: 800, bottom: 100, x: 0, y: 0 };
};
const realGCS = window.getComputedStyle.bind(window);
window.getComputedStyle = (el) => {
  try { const s = realGCS(el); return new Proxy(s, { get: (t, p) => (p === 'display' ? 'block' : p === 'visibility' ? 'visible' : (t[p] ?? '')) }); }
  catch { return { display: 'block', visibility: 'visible', backgroundColor: '' }; }
};
window.HTMLMediaElement && (window.HTMLMediaElement.prototype.pause = () => {});

// Minimal mock chrome API.
let onMessage = null;
const chrome = {
  storage: {
    local: { get: (_k, cb) => cb && cb({}), set: () => {} },
    onChanged: { addListener: () => {} },
  },
  runtime: {
    onConnect: { addListener: () => {} },
    onMessage: { addListener: (fn) => { onMessage = fn; } },
  },
};

global.window = window;
global.document = window.document;
global.getComputedStyle = window.getComputedStyle;
global.chrome = window.chrome = chrome;
global.MutationObserver = window.MutationObserver;

// Load the REAL engine files verbatim, in manifest order.
for (const f of ['./comis/simplify.js', './comis/content.js']) {
  const code = fs.readFileSync(f, 'utf8');
  new Function('window', 'document', 'getComputedStyle', 'chrome', 'MutationObserver', code)(window, window.document, window.getComputedStyle, chrome, window.MutationObserver);
}

// Send a message the way the popup does, capturing the synchronous response.
const send = (message) => { let resp = null; onMessage(message, {}, (r) => { resp = r; }); return resp; };
const apply = (text) => send({ type: 'APPLY_COMMAND', command: P.parse(text, null).command });
const D = window.document;

console.log('Extension engine — end-to-end via chrome messaging');
ok(!!onMessage, 'content.js registered its message listener');

// GET_STATE
const s0 = send({ type: 'GET_STATE' });
ok(s0 && s0.state && s0.adaptations.length === 0, 'GET_STATE returns clean initial state');

// Simplify
const rSimplify = apply('simplify this page');
ok(D.querySelector('[data-vv-main]')?.tagName === 'ARTICLE', 'Simplify: <article> chosen as main content');
ok(D.querySelectorAll('[data-vv-hide]').length >= 5, `Simplify: clutter hidden (${rSimplify.lastSimplify.hidden} blocks)`);

// Larger text
apply('make the text bigger');
ok(parseFloat(D.body.style.zoom) > 1, `Larger text: body zoom = ${D.body.style.zoom}`);

// Dark mode
apply('dark mode');
ok(/invert\(/.test(D.body.style.filter), 'Dark mode: invert filter applied to body');

// Reduce motion
const rMotion = apply('stop all animations');
ok(!!D.getElementById('vv-reduce-motion-style'), 'Reduce motion: stylesheet injected');
ok(rMotion.adaptations.some((a) => a.key === 'reduceMotion'), 'Reduce motion: shows in active adaptations');

// Undo reverts ONLY the last change (reduce motion)
const rUndo = send({ type: 'UNDO' });
ok(!D.getElementById('vv-reduce-motion-style'), 'Undo: reduce-motion removed');
ok(/invert\(/.test(D.body.style.filter), 'Undo: dark mode still active (only last change reverted)');
ok(rUndo.canUndo === true, 'Undo: more undo history remains');

// Reset tears everything down
send({ type: 'RESET' });
ok(D.body.style.filter === 'none' || D.body.style.filter === '', 'Reset: body filter cleared');
ok(!D.body.style.zoom, 'Reset: body zoom cleared');
ok(D.querySelectorAll('[data-vv-main]').length === 0, 'Reset: simplify main marker removed');
ok(D.querySelectorAll('[data-vv-hide]').length === 0, 'Reset: all hidden blocks restored');
ok(!D.getElementById('vv-reduce-motion-style') && !D.getElementById('vv-assist-style'), 'Reset: injected stylesheets removed');
const sEnd = send({ type: 'GET_STATE' });
ok(sEnd.adaptations.length === 0 && !sEnd.canUndo, 'Reset: state back to clean, undo history cleared');

console.log(failures ? `\nFAILED: ${failures} assertion(s)` : '\nAll engine assertions passed.');
process.exit(failures ? 1 : 0);
