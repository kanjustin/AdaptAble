/**
 * AdaptAble — Simplify = make the page's TEXT easier to read and understand.
 *
 * It does NOT change the site's layout: nothing is hidden, moved, or restructured.
 * It only injects a gentle readability stylesheet — larger text, more line-height,
 * calmer letter/word spacing, roomier paragraphs — applied in place across the page.
 * Because it's pure text styling it works reliably on any website and can't break the
 * layout. Fully reversible (remove the class + style tag).
 *
 * Exposed as window.__VV_SIMPLIFY so the content-script engine can drive it. The
 * findMain/getContentNode helpers remain for read-aloud and repositioning.
 */
(function () {
  if (window.__VV_SIMPLIFY) return;

  const STYLE_ID = 'vv-simplify-style';
  const ON_CLASS = 'vv-simplify-on';

  // ---- readability stylesheet (text only — no layout changes) ----
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    // Never restyle AdaptAble's own on-page UI (the playground panel / find badge).
    const EX = ':not(#vv-panel):not(#vv-panel *):not(#vv-find-badge):not(#vv-find-badge *)';
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.${ON_CLASS} :where(p,li,dd,dt,blockquote,td,figcaption)${EX}{
        line-height:1.75 !important;
        letter-spacing:0.012em !important;
        word-spacing:0.04em !important;
      }
      html.${ON_CLASS} :where(p,li,blockquote)${EX}{
        font-size:1.12em !important;
        margin-block:0.72em !important;
      }
      html.${ON_CLASS} :where(h1,h2,h3,h4)${EX}{ line-height:1.3 !important; }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function apply() {
    injectStyle();
    document.documentElement.classList.add(ON_CLASS);
    return { ok: true };
  }
  function teardown() {
    document.documentElement.classList.remove(ON_CLASS);
    const s = document.getElementById(STYLE_ID);
    if (s) s.remove();
  }
  function isActive() {
    return document.documentElement.classList.contains(ON_CLASS);
  }

  // ---- main-content detection (used by read-aloud & repositioning; hides nothing) ----
  const CLUTTER_RE = /(^|[-_ ])(nav|menu|sidebar|side-bar|footer|masthead|banner|breadcrumb|comment|promo|sponsor|advert|\bads?\b|widget|social|share|related|recommend|newsletter|subscribe|signup|cookie|consent|gdpr|popup|modal|overlay|toolbar|pagination|tags?|meta)($|[-_ ])/i;
  const isOurNode = (el) => (el.id && el.id.indexOf('vv-') === 0) || /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(el.tagName);

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  }
  function linkDensity(el) {
    const total = (el.textContent || '').replace(/\s+/g, ' ').trim().length || 1;
    let linkLen = 0;
    el.querySelectorAll('a').forEach((a) => { linkLen += (a.textContent || '').trim().length; });
    return Math.min(1, linkLen / total);
  }
  function score(el) {
    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    if (text.length < 200) return -1;
    let s = text.length * (1 - linkDensity(el));
    const tag = el.tagName;
    if (tag === 'ARTICLE' || tag === 'MAIN') s *= 1.6;
    else if (tag === 'SECTION') s *= 1.2;
    const idClass = ((el.id || '') + ' ' + (el.className || '')).toString();
    if (CLUTTER_RE.test(idClass)) s *= 0.25;
    if (/(article|content|post|story|main|body|entry|prose|markdown|readme)/i.test(idClass)) s *= 1.4;
    const nodes = el.getElementsByTagName('*').length || 1;
    s *= Math.min(1.5, 1 + (text.length / nodes) / 200);
    return s;
  }
  function findMain() {
    const semantic = Array.from(document.querySelectorAll('main, [role="main"], article'))
      .filter((el) => isVisible(el) && (el.textContent || '').trim().length > 200)
      .sort((a, b) => score(b) - score(a));
    if (semantic.length) return semantic[0];
    let best = null;
    let bestScore = 0;
    for (const el of document.querySelectorAll('body div, body section, body article')) {
      if (isOurNode(el) || !isVisible(el)) continue;
      const sc = score(el);
      if (sc > bestScore) { bestScore = sc; best = el; }
    }
    return best;
  }
  function getContentNode() { return findMain() || document.body; }

  window.__VV_SIMPLIFY = { apply, teardown, isActive, getContentNode, findMain };
})();
