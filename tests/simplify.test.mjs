/**
 * Regression test for Simplify Page against the cluttered demo page.
 * jsdom has no layout engine, so we stub getBoundingClientRect/getComputedStyle to
 * let the visibility + density scoring run. Verifies the real shipped simplify.js.
 *
 * Run: node tests/simplify.test.mjs
 */
import { JSDOM } from 'jsdom';
import fs from 'node:fs';

let failures = 0;
const assert = (cond, msg) => { if (!cond) { console.error('  ✗ ' + msg); failures++; } else { console.log('  ✓ ' + msg); } };

const html = fs.readFileSync('./public/demo.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only' });
const { window } = dom;

window.Element.prototype.getBoundingClientRect = function () {
  const len = (this.textContent || '').length;
  return { width: 800, height: Math.max(10, Math.min(len, 2000)), top: 0, left: 0, right: 800, bottom: 100 };
};
const realGCS = window.getComputedStyle.bind(window);
window.getComputedStyle = (el) => {
  try {
    const s = realGCS(el);
    return new Proxy(s, { get: (t, p) => (p === 'display' ? 'block' : p === 'visibility' ? 'visible' : (t[p] ?? '')) });
  } catch { return { display: 'block', visibility: 'visible', backgroundColor: '' }; }
};

global.window = window;
global.document = window.document;
global.getComputedStyle = window.getComputedStyle;

const code = fs.readFileSync('./adaptable/simplify.js', 'utf8');
new Function('window', 'document', 'getComputedStyle', code)(window, window.document, window.getComputedStyle);
const S = window.__VV_SIMPLIFY;

const D = window.document;
console.log('Simplify — readability pass (no layout changes)');
assert(!!S, 'module loads');
assert(typeof S.findMain === 'function', 'findMain retained (used by read-aloud / reposition)');

const res = S.apply();
assert(res.ok, 'apply() succeeds');
assert(D.documentElement.classList.contains('vv-simplify-on'), 'adds the readability class to <html>');
assert(!!D.getElementById('vv-simplify-style'), 'injects the readability stylesheet');
assert(D.querySelectorAll('[data-vv-hide]').length === 0, 'hides NOTHING (page layout unchanged)');
assert(D.querySelectorAll('[data-vv-main]').length === 0, 'does NOT restructure into a reader container');
assert(!!D.getElementById('az-cookie'), 'cookie banner still present (nothing removed)');
assert(!!D.querySelector('header.az-nav'), 'nav still present (nothing removed)');
assert(D.querySelectorAll('button.az-btn').length >= 2, 'buy-box buttons still present and untouched');

S.teardown();
assert(!D.documentElement.classList.contains('vv-simplify-on'), 'teardown removes the readability class');
assert(!D.getElementById('vv-simplify-style'), 'teardown removes the stylesheet');

console.log(failures ? `\nFAILED: ${failures} assertion(s)` : '\nAll simplify assertions passed.');
process.exit(failures ? 1 : 0);
