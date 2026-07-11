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

const code = fs.readFileSync('./extension/simplify.js', 'utf8');
new Function('window', 'document', 'getComputedStyle', code)(window, window.document, window.getComputedStyle);
const S = window.__VV_SIMPLIFY;

console.log('Simplify Page — demo page');
assert(!!S, 'module loads');
const chosen = S.findMain();
assert(chosen && chosen.tagName === 'ARTICLE', 'picks the <article> as main content');

const res = S.apply();
assert(res.ok, 'apply() succeeds');
assert(res.hidden >= 5, `hides multiple clutter blocks (hid ${res.hidden})`);

const mainEl = window.document.querySelector('[data-vv-main]');
assert(mainEl && !!mainEl.querySelector('h1'), 'main content (with heading) is preserved');
assert(window.document.querySelectorAll('[data-vv-keep]').length > 0, 'ancestors are marked data-vv-keep (layout neutralized so column is not squeezed)');
assert(mainEl.parentElement.hasAttribute('data-vv-keep'), 'the immediate parent container is neutralized');
assert(window.document.getElementById('az-cookie').hasAttribute('data-vv-hide'), 'cookie banner is hidden');
assert(window.document.getElementById('az-popup').hasAttribute('data-vv-hide'), 'newsletter popup is hidden');
assert(window.document.getElementById('az-chat').hasAttribute('data-vv-hide'), 'floating chat widget is hidden');
assert(window.document.querySelector('header.az-nav').hasAttribute('data-vv-hide'), 'top nav bar is hidden');
assert(window.document.querySelector('.az-departments').hasAttribute('data-vv-hide'), 'left filter sidebar is hidden');
assert(mainEl.querySelectorAll('button.az-btn').length >= 2 && !mainEl.hasAttribute('data-vv-hide'), 'buy-box buttons (Add to Cart / Buy Now) are preserved');

S.teardown();
assert(window.document.querySelectorAll('[data-vv-main]').length === 0, 'teardown removes main marker');
assert(window.document.querySelectorAll('[data-vv-hide]').length === 0, 'teardown restores every hidden block');
assert(window.document.querySelectorAll('[data-vv-keep]').length === 0, 'teardown removes ancestor keep markers');

console.log(failures ? `\nFAILED: ${failures} assertion(s)` : '\nAll simplify assertions passed.');
process.exit(failures ? 1 : 0);
