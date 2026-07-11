/**
 * VoiceVision — Simplify Page (the centerpiece).
 *
 * Deterministic, reversible main-content extraction. No page content ever leaves the
 * browser. We NEVER delete nodes — we only add a `data-vv-*` attribute, one <style>
 * element, and a class, so teardown is a clean, complete restore.
 *
 * Strategy: find the primary content node (semantic tags first, then a text-vs-link
 * density score), then hide every sibling *off the path* from <body> to that node.
 * Links, buttons, and images inside the main content stay fully interactive.
 *
 * Exposed as window.__VV_SIMPLIFY so the content-script engine can drive it.
 */
(function () {
  if (window.__VV_SIMPLIFY) return;

  const HIDE_ATTR = 'data-vv-hide';
  const MAIN_ATTR = 'data-vv-main';
  const STYLE_ID = 'vv-simplify-style';

  // id/class fragments that signal chrome/clutter rather than article content.
  const CLUTTER_RE = /(^|[-_ ])(nav|menu|sidebar|side-bar|footer|header|masthead|banner|breadcrumb|comment|promo|sponsor|advert|\bads?\b|widget|social|share|related|recommend|newsletter|subscribe|signup|cookie|consent|gdpr|popup|modal|overlay|toolbar|pagination|tags?|meta)($|[-_ ])/i;
  // Standalone overlays worth hiding wherever they sit in the tree.
  const OVERLAY_SEL = '[class*="cookie" i],[id*="cookie" i],[class*="consent" i],[class*="gdpr" i],[class*="newsletter" i],[class*="paywall" i],[aria-modal="true"][role="dialog"]';

  const isOurNode = (el) =>
    el.id && el.id.indexOf('vv-') === 0 ||
    el.hasAttribute('data-vv-main') ||
    /^(SCRIPT|STYLE|LINK|NOSCRIPT|TEMPLATE)$/.test(el.tagName);

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

  // Higher score = more likely to be the real article body.
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
    // Prefer denser blocks (more text per descendant element).
    const nodes = el.getElementsByTagName('*').length || 1;
    s *= Math.min(1.5, 1 + (text.length / nodes) / 200);
    return s;
  }

  function findMain() {
    // 1) Trust explicit semantics when they hold real text.
    const semantic = Array.from(document.querySelectorAll('main, [role="main"], article'))
      .filter((el) => isVisible(el) && (el.textContent || '').trim().length > 200)
      .sort((a, b) => score(b) - score(a));
    if (semantic.length) return semantic[0];

    // 2) Otherwise score block containers and take the best.
    let best = null;
    let bestScore = 0;
    const candidates = document.querySelectorAll('body div, body section, body article');
    for (const el of candidates) {
      if (isOurNode(el) || !isVisible(el)) continue;
      const sc = score(el);
      if (sc > bestScore) { bestScore = sc; best = el; }
    }
    return best;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      [${HIDE_ATTR}]{display:none !important;}
      [${MAIN_ATTR}]{
        max-width:72ch !important;
        margin:0 auto !important;
        float:none !important;
        position:static !important;
        width:auto !important;
        padding:28px 32px !important;
        font-size:1.15rem !important;
        line-height:1.7 !important;
        box-sizing:border-box !important;
      }
      [${MAIN_ATTR}] img,[${MAIN_ATTR}] video,[${MAIN_ATTR}] figure{max-width:100% !important;height:auto !important;}
      [${MAIN_ATTR}] p,[${MAIN_ATTR}] li{margin-block:0.7em !important;}
      [${MAIN_ATTR}] h1,[${MAIN_ATTR}] h2,[${MAIN_ATTR}] h3{line-height:1.25 !important;margin-block:0.8em 0.4em !important;}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /**
   * Apply simplification. Returns a summary { hidden, ok } or { ok:false }.
   */
  function apply() {
    teardown(); // idempotent — always start clean
    const main = findMain();
    if (!main) return { ok: false, hidden: 0 };

    injectStyle();
    main.setAttribute(MAIN_ATTR, '');

    // Hide every sibling off the path from <body> up to (and around) the main node.
    let node = main;
    let hidden = 0;
    while (node && node.parentElement && node !== document.body && node !== document.documentElement) {
      const parent = node.parentElement;
      for (const sib of Array.from(parent.children)) {
        if (sib === node || isOurNode(sib) || sib.hasAttribute(HIDE_ATTR)) continue;
        sib.setAttribute(HIDE_ATTR, '');
        hidden++;
      }
      node = parent;
    }

    // Also hide standalone cookie/consent/newsletter overlays anywhere in the tree.
    document.querySelectorAll(OVERLAY_SEL).forEach((el) => {
      if (isOurNode(el) || el.hasAttribute(MAIN_ATTR) || el.contains(main) || main.contains(el)) return;
      if (!el.hasAttribute(HIDE_ATTR)) { el.setAttribute(HIDE_ATTR, ''); hidden++; }
    });

    return { ok: true, hidden, main };
  }

  function teardown() {
    document.querySelectorAll('[' + HIDE_ATTR + ']').forEach((el) => el.removeAttribute(HIDE_ATTR));
    document.querySelectorAll('[' + MAIN_ATTR + ']').forEach((el) => el.removeAttribute(MAIN_ATTR));
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
  }

  function isActive() {
    return !!document.querySelector('[' + MAIN_ATTR + ']');
  }

  // Best-guess main content node WITHOUT hiding anything — used by read-aloud and
  // repositioning when Simplify is not active.
  function getContentNode() {
    return document.querySelector('[' + MAIN_ATTR + ']') || findMain() || document.body;
  }

  window.__VV_SIMPLIFY = { apply, teardown, isActive, getContentNode, findMain };
})();
