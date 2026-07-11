/**
 * Comis — content-script engine (the "hands").
 *
 * Applies ONLY predefined, reversible DOM/CSS transformations. It never runs
 * model-supplied code, selectors, or CSS. Commands arrive already-parsed (locally or
 * via the validated API) from the popup; this script merges them into a typed state,
 * keeps an undo history, and re-renders. No page content is read for interpretation.
 *
 * Two labelled surfaces share this one engine:
 *   • Assist Mode      — larger text, spacing, contrast, dark/dim/warm, reduce motion,
 *                        focus highlight, Simplify Page, repositioning, colour distinction,
 *                        read-aloud.
 *   • Simulation Mode  — developer-only colour-blindness / vision-loss previews.
 */
(function () {
  if (window.__voicevisionInjected) return;
  window.__voicevisionInjected = true;

  const FILTER_IDS = {
    deuteranopia: 'vv-deuteranopia',
    protanopia: 'vv-protanopia',
    tritanopia: 'vv-tritanopia',
  };

  // RGB coefficients (3x3) for each color-blindness SIMULATION, Chrome Blink linearRGB.
  const COLOR_MATRICES = {
    deuteranopia: [[0.367, 0.861, -0.228], [0.280, 0.673, 0.047], [-0.012, 0.043, 0.969]],
    protanopia: [[0.152, 0.848, 0], [0.114, 0.886, 0], [0, 0.094, 0.906]],
    tritanopia: [[1, 0.168, -0.168], [0, 0.920, 0.080], [0, 0.923, 0.077]],
  };
  const IDENTITY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

  function blendMatrixValues(matrix, t) {
    const rows = matrix.map((row, i) => row.map((v, j) => (IDENTITY[i][j] * (1 - t) + v * t).toFixed(3)));
    return [...rows.map((row) => `${row.join(' ')} 0 0`), '0 0 0 1 0'].join('\n');
  }

  function updateColorMatrices(intensity) {
    for (const mode of Object.keys(COLOR_MATRICES)) {
      const el = document.getElementById(`${FILTER_IDS[mode]}-matrix`);
      if (el) el.setAttribute('values', blendMatrixValues(COLOR_MATRICES[mode], intensity));
    }
  }

  // Inject SVG colour-matrix defs once. color-interpolation-filters="linearRGB" required.
  function injectFilterDefs() {
    if (document.getElementById(FILTER_IDS.deuteranopia)) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.id = 'vv-filter-defs';
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;';
    svg.innerHTML = `
      <defs>
        <filter id="${FILTER_IDS.deuteranopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.deuteranopia}-matrix" type="matrix" values="0.367 0.861 -0.228 0 0 0.280 0.673 0.047 0 0 -0.012 0.043 0.969 0 0 0 0 0 1 0"/>
        </filter>
        <filter id="${FILTER_IDS.protanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.protanopia}-matrix" type="matrix" values="0.152 0.848 0 0 0 0.114 0.886 0 0 0 0 0.094 0.906 0 0 0 0 0 1 0"/>
        </filter>
        <filter id="${FILTER_IDS.tritanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.tritanopia}-matrix" type="matrix" values="1 0.168 -0.168 0 0 0 0.920 0.080 0 0 0 0.923 0.077 0 0 0 0 0 1 0"/>
        </filter>
      </defs>`;
    (document.body || document.documentElement).appendChild(svg);
  }
  injectFilterDefs();

  const DEFAULT_INTENSITIES = {
    colorMode: 1, darkMode: 1, highContrast: 1, warmTone: 1,
    invertColors: 1, blur: 0.5, zoom: 0.5, dimOverlay: 0.5,
  };

  function defaultState() {
    return {
      // simulation + comfort (original)
      colorMode: null, darkMode: false, highContrast: false, brightness: null,
      warmTone: false, invertColors: false, blur: false, hemianopia: null, zoom: null,
      dimOverlay: false, boldText: false, reduceMotion: false,
      // assist (new)
      textScale: null, lineSpacing: null, letterSpacing: null, paraSpacing: null,
      focusHighlight: false, simplify: false, reposition: null, colorDistinction: false,
      intensities: { ...DEFAULT_INTENSITIES },
    };
  }

  // Keys merged from an incoming command (null = leave unchanged, mirrors parser output).
  const MERGE_KEYS = [
    'colorMode', 'darkMode', 'highContrast', 'brightness', 'warmTone', 'invertColors',
    'blur', 'hemianopia', 'zoom', 'dimOverlay', 'boldText', 'reduceMotion',
    'textScale', 'lineSpacing', 'letterSpacing', 'paraSpacing', 'focusHighlight',
    'simplify', 'reposition', 'colorDistinction',
  ];

  let state = defaultState();
  const undoStack = [];
  const UNDO_LIMIT = 25;
  let lastSimplify = { hidden: 0, ok: false };
  let simplifyObserver = null;
  let simplifyTimer = null;

  const clone = (s) => JSON.parse(JSON.stringify(s));
  const pushUndo = () => { undoStack.push(clone(state)); if (undoStack.length > UNDO_LIMIT) undoStack.shift(); };

  // ---- CSS `filter` composition (simulation + comfort) --------------------
  function buildFilterString(s) {
    const { intensities } = s;
    const parts = [];
    if (s.colorMode === 'achromatopsia') parts.push(`grayscale(${Math.round(intensities.colorMode * 100)}%)`);
    else if (s.colorMode) parts.push(`url(#${FILTER_IDS[s.colorMode]})`);
    if (s.darkMode) parts.push(`invert(${Math.round(93 * intensities.darkMode)}%) hue-rotate(180deg)`);
    if (s.invertColors && !s.darkMode) parts.push(`invert(${Math.round(100 * intensities.invertColors)}%) hue-rotate(180deg)`);
    if (s.warmTone) parts.push(`sepia(${Math.round(25 * intensities.warmTone)}%)`);
    if (s.highContrast) parts.push(`contrast(${Math.round(100 + 50 * intensities.highContrast)}%)`);
    if (s.colorDistinction) parts.push('saturate(1.5) contrast(108%)');
    if (s.blur) {
      parts.push(`contrast(${Math.round(100 + 60 * intensities.blur)}%)`);
      parts.push(`brightness(${Math.round(100 + 15 * intensities.blur)}%)`);
    }
    if (s.brightness !== null) parts.push(`brightness(${s.brightness})`);
    if (s.darkMode && s.brightness === null) parts.push(`brightness(${(1 - 0.2 * intensities.darkMode).toFixed(2)})`);
    return parts.join(' ') || 'none';
  }

  function applyFilters() {
    updateColorMatrices(state.intensities.colorMode);
    // Safari does not render CSS `filter` on <html> — apply to <body>.
    document.body.style.filter = buildFilterString(state);
    document.documentElement.style.colorScheme = state.darkMode ? 'dark' : '';
  }

  // ---- Assist: larger text (body zoom — reflows like native browser zoom) -
  function applyTextScale() {
    const s = state.textScale;
    document.body.style.zoom = s && s > 1.0 ? String(s) : '';
  }

  // ---- Assist: one regenerated stylesheet for spacing / focus / distinction
  function assistStyleText() {
    const rules = [];
    if (state.lineSpacing && state.lineSpacing > 0) {
      rules.push(`body :where(p,li,dd,blockquote,article,section,span,td){line-height:${state.lineSpacing} !important;}`);
    }
    if (state.letterSpacing && state.letterSpacing > 0) {
      rules.push(`body :where(p,li,a,span,h1,h2,h3,h4){letter-spacing:${state.letterSpacing}em !important;}`);
    }
    if (state.paraSpacing && state.paraSpacing > 0) {
      rules.push(`body :where(p,li,blockquote){margin-block:${state.paraSpacing}em !important;}`);
    }
    if (state.focusHighlight) {
      rules.push('*:focus,*:focus-visible{outline:3px solid #2563eb !important;outline-offset:2px !important;}');
      rules.push('body :where(p,li,h1,h2,h3,tr):hover{background:rgba(37,99,235,0.12) !important;border-radius:4px;}');
    }
    if (state.colorDistinction) {
      // Reduce colour-only reliance: underline links, outline buttons/badges.
      rules.push('body a{text-decoration:underline !important;}');
      rules.push('body :where(button,[role="button"],.badge,[class*="status" i],[class*="tag" i]){outline:1.5px solid rgba(0,0,0,0.45) !important;outline-offset:1px;}');
    }
    return rules.join('\n');
  }

  function applyAssistStyles() {
    const css = assistStyleText();
    let style = document.getElementById('vv-assist-style');
    if (!css) { if (style) style.remove(); return; }
    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-assist-style';
      document.head.appendChild(style);
    }
    style.textContent = css;
  }

  // ---- Assist: colour distinction labels on red/green chart marks ----------
  // Adds a short text symbol so meaning survives when colour is removed. Bounded
  // to a small candidate set; fully reversible (removes [data-vv-label]).
  function applyColorLabels(active) {
    document.querySelectorAll('[data-vv-label]').forEach((el) => el.remove());
    if (!active) return;
    const reddish = (r, g, b) => r > 110 && r > g * 1.4 && r > b * 1.4;
    const greenish = (r, g, b) => g > 90 && g > r * 1.25 && g > b * 1.2;
    const parseRGB = (str) => {
      if (!str) return null;
      const rgb = str.match(/rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/i);
      if (rgb) return [+rgb[1], +rgb[2], +rgb[3]];
      const hex = str.match(/^#([0-9a-f]{6})$/i);
      if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
      return null;
    };
    let count = 0;
    const marks = document.querySelectorAll('svg rect, svg path, svg circle, [class*="status" i], [class*="badge" i]');
    for (const el of marks) {
      if (count > 60) break;
      const fill = el.getAttribute && el.getAttribute('fill');
      const rgb = parseRGB(fill) || parseRGB(getComputedStyle(el).backgroundColor);
      if (!rgb) continue;
      let sym = '';
      if (reddish(...rgb)) sym = '▲';
      else if (greenish(...rgb)) sym = '●';
      if (!sym) continue;
      const tag = document.createElement('span');
      tag.setAttribute('data-vv-label', '');
      tag.textContent = ' ' + sym;
      tag.style.cssText = 'font-weight:700;font-size:11px;';
      if (el.namespaceURI && el.namespaceURI.indexOf('svg') > -1) { if (el.setAttribute) el.setAttribute('data-vv-mark', sym); continue; }
      el.appendChild(tag);
      count++;
    }
  }

  // ---- Assist: content repositioning --------------------------------------
  function applyReposition(dir) {
    document.querySelectorAll('[data-vv-repos]').forEach((el) => el.removeAttribute('data-vv-repos'));
    let style = document.getElementById('vv-reposition-style');
    if (!dir || dir === 'center') { if (style) style.remove(); return; }
    const target = (window.__VV_SIMPLIFY && window.__VV_SIMPLIFY.getContentNode()) || document.body;
    if (target && target.setAttribute) target.setAttribute('data-vv-repos', '');
    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-reposition-style';
      document.head.appendChild(style);
    }
    const side = dir === 'right'
      ? 'margin-left:auto !important;margin-right:2vw !important;'
      : 'margin-right:auto !important;margin-left:2vw !important;';
    style.textContent = `[data-vv-repos]{max-width:58% !important;float:none !important;${side}}`;
  }

  // ---- Simulation overlays (unchanged behaviour) --------------------------
  function applyZoom(zoom, intensity) {
    let overlay = document.getElementById('vv-zoom-overlay');
    if (zoom === 'full') {
      if (overlay) overlay.remove();
      document.documentElement.style.zoom = `${Math.round(100 + intensity * 150)}%`;
      return;
    }
    document.documentElement.style.zoom = '';
    if (!zoom) { if (overlay) overlay.remove(); return; }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-zoom-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(overlay);
    }
    const visibleRadius = Math.round(45 - intensity * 30);
    const midRadius = Math.min(95, visibleRadius + 25);
    if (zoom === 'center') {
      overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="vv-mac-grad" cx="50%" cy="50%" r="${visibleRadius}%"><stop offset="0%" stop-color="black" stop-opacity="0.7"/><stop offset="60%" stop-color="black" stop-opacity="0.3"/><stop offset="100%" stop-color="black" stop-opacity="0"/></radialGradient><filter id="vv-mac-blur"><feGaussianBlur stdDeviation="3"/></filter></defs><rect width="100%" height="100%" fill="url(#vv-mac-grad)" filter="url(#vv-mac-blur)"/></svg>`;
    } else if (zoom === 'peripheral') {
      overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="vv-tunnel-grad" cx="50%" cy="50%" r="${midRadius}%"><stop offset="0%" stop-color="black" stop-opacity="0"/><stop offset="${Math.max(10, visibleRadius)}%" stop-color="black" stop-opacity="0.5"/><stop offset="100%" stop-color="black" stop-opacity="0.92"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#vv-tunnel-grad)"/></svg>`;
    }
  }

  function applyHemianopia(side) {
    let overlay = document.getElementById('vv-hemianopia-overlay');
    if (!side) { if (overlay) overlay.remove(); return; }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-hemianopia-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
      document.body.appendChild(overlay);
    }
    const gradientDir = side === 'left' ? 'to right' : 'to left';
    overlay.innerHTML = `<div style="position:absolute;inset:0;width:55%;${side === 'right' ? 'right:0;left:auto;' : 'left:0;'}background:linear-gradient(${gradientDir}, black 80%, transparent 100%);"></div>`;
  }

  function applyDimOverlay(active, intensity) {
    let overlay = document.getElementById('vv-dim-overlay');
    if (!active) { if (overlay) overlay.remove(); return; }
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-dim-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;background:black;';
      document.body.appendChild(overlay);
    }
    overlay.style.opacity = (0.15 + intensity * 0.45).toFixed(2);
  }

  const BOLD_TEXT_CSS = `body, p, span, a, li, h1, h2, h3, h4, h5, h6, label, button, td, th, input, textarea { font-weight: 600 !important; }`;
  function applyBoldText(active) {
    let style = document.getElementById('vv-bold-text-style');
    if (!active) { if (style) style.remove(); return; }
    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-bold-text-style';
      style.textContent = BOLD_TEXT_CSS;
      document.head.appendChild(style);
    }
  }

  const REDUCE_MOTION_CSS = `*, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }`;
  function applyReduceMotion(active) {
    let style = document.getElementById('vv-reduce-motion-style');
    if (!active) { if (style) style.remove(); return; }
    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-reduce-motion-style';
      style.textContent = REDUCE_MOTION_CSS;
      document.head.appendChild(style);
    }
    document.querySelectorAll('video[autoplay]').forEach((v) => v.pause());
  }

  // ---- Simplify Page integration + dynamic-page observer ------------------
  function startSimplifyObserver() {
    if (simplifyObserver) return;
    simplifyObserver = new MutationObserver(() => {
      if (!state.simplify) return;
      clearTimeout(simplifyTimer);
      simplifyTimer = setTimeout(() => {
        if (!state.simplify || !window.__VV_SIMPLIFY) return;
        if (window.__VV_SIMPLIFY.isActive()) return; // still applied — nothing to do
        simplifyObserver.disconnect();
        lastSimplify = window.__VV_SIMPLIFY.apply();
        simplifyObserver.observe(document.body, { childList: true, subtree: true });
      }, 400);
    });
    simplifyObserver.observe(document.body, { childList: true, subtree: true });
  }
  function stopSimplifyObserver() {
    if (simplifyObserver) { simplifyObserver.disconnect(); simplifyObserver = null; }
    clearTimeout(simplifyTimer);
  }

  function applySimplify() {
    if (!window.__VV_SIMPLIFY) return;
    if (state.simplify) {
      if (!window.__VV_SIMPLIFY.isActive()) {
        stopSimplifyObserver();
        lastSimplify = window.__VV_SIMPLIFY.apply();
        startSimplifyObserver();
      }
    } else {
      stopSimplifyObserver();
      window.__VV_SIMPLIFY.teardown();
      lastSimplify = { hidden: 0, ok: false };
    }
  }

  // ---- Read-aloud (Web Speech synthesis) ----------------------------------
  const tts = { chunks: [], index: 0, active: false, paused: false };
  const READ_STYLE_ID = 'vv-read-style';

  function ensureReadStyle() {
    if (document.getElementById(READ_STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = READ_STYLE_ID;
    st.textContent = '.vv-reading{background:#fde68a !important;color:#111 !important;box-shadow:0 0 0 4px #fde68a !important;border-radius:3px;}';
    document.head.appendChild(st);
  }

  function collectReadable() {
    const root = (window.__VV_SIMPLIFY && window.__VV_SIMPLIFY.getContentNode()) || document.body;
    const els = root.querySelectorAll('h1,h2,h3,h4,p,li,blockquote,figcaption');
    const out = [];
    els.forEach((el) => {
      if (el.closest('[data-vv-hide]')) return;
      const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length >= 2) out.push({ el, text });
    });
    return out;
  }

  function clearReadingHighlight() {
    document.querySelectorAll('.vv-reading').forEach((el) => el.classList.remove('vv-reading'));
  }

  function speakNext() {
    if (!tts.active || tts.index >= tts.chunks.length) { stopReading(); return; }
    const { el, text } = tts.chunks[tts.index];
    clearReadingHighlight();
    if (el && el.classList) { el.classList.add('vv-reading'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    const u = new SpeechSynthesisUtterance(text);
    u.onend = () => { if (tts.active && !tts.paused) { tts.index++; speakNext(); } };
    u.onerror = () => { tts.index++; if (tts.active) speakNext(); };
    window.speechSynthesis.speak(u);
  }

  function startReading() {
    if (!('speechSynthesis' in window)) return { supported: false };
    stopReading();
    ensureReadStyle();
    tts.chunks = collectReadable();
    tts.index = 0;
    tts.active = tts.chunks.length > 0;
    tts.paused = false;
    if (tts.active) speakNext();
    return { supported: true, reading: tts.active, blocks: tts.chunks.length };
  }
  function stopReading() {
    tts.active = false; tts.paused = false;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    clearReadingHighlight();
  }
  function pauseReading() { if (tts.active) { tts.paused = true; window.speechSynthesis.pause(); } }
  function resumeReading() { if (tts.active && tts.paused) { tts.paused = false; window.speechSynthesis.resume(); } }

  // ---- Render everything from current state -------------------------------
  function applyAll() {
    applyFilters();
    applyTextScale();
    applyAssistStyles();
    applyColorLabels(state.colorDistinction);
    applyReposition(state.reposition);
    applySimplify();
    applyZoom(state.zoom, state.intensities.zoom);
    applyHemianopia(state.hemianopia);
    applyDimOverlay(state.dimOverlay, state.intensities.dimOverlay);
    applyBoldText(state.boldText);
    applyReduceMotion(state.reduceMotion);
  }

  function persistState() {
    try { chrome.storage.local.set({ vvState: state }); } catch (_) { /* storage may be unavailable */ }
  }

  function resetAll() {
    stopSimplifyObserver();
    stopReading();
    if (window.__VV_SIMPLIFY) window.__VV_SIMPLIFY.teardown();
    state = defaultState();
    undoStack.length = 0;
    lastSimplify = { hidden: 0, ok: false };
    const root = document.documentElement;
    document.body.style.filter = 'none';
    document.body.style.zoom = '';
    root.style.colorScheme = '';
    root.style.zoom = '';
    applyZoom(null, 0);
    applyHemianopia(null);
    applyDimOverlay(false, 0);
    applyBoldText(false);
    applyReduceMotion(false);
    applyAssistStyles();
    applyColorLabels(false);
    applyReposition(null);
    ['vv-read-style'].forEach((id) => { const el = document.getElementById(id); if (el) el.remove(); });
  }

  // Active adaptation labels for the popup (Assist Mode) + a simulation count.
  function activeAdaptations() {
    const a = [];
    if (state.simplify) a.push({ key: 'simplify', label: 'Simplified page' });
    if (state.textScale && state.textScale > 1) a.push({ key: 'textScale', label: `Larger text (${Math.round(state.textScale * 100)}%)` });
    if (state.lineSpacing) a.push({ key: 'lineSpacing', label: 'More line spacing' });
    if (state.letterSpacing) a.push({ key: 'letterSpacing', label: 'More letter spacing' });
    if (state.paraSpacing) a.push({ key: 'paraSpacing', label: 'More paragraph spacing' });
    if (state.boldText) a.push({ key: 'boldText', label: 'Bolder text' });
    if (state.highContrast) a.push({ key: 'highContrast', label: 'High contrast', intensityKey: 'highContrast' });
    if (state.darkMode) a.push({ key: 'darkMode', label: 'Dark mode', intensityKey: 'darkMode' });
    if (state.dimOverlay) a.push({ key: 'dimOverlay', label: 'Dimmed', intensityKey: 'dimOverlay' });
    if (state.warmTone) a.push({ key: 'warmTone', label: 'Warm colors', intensityKey: 'warmTone' });
    if (state.reduceMotion) a.push({ key: 'reduceMotion', label: 'Reduced motion' });
    if (state.focusHighlight) a.push({ key: 'focusHighlight', label: 'Focus highlight' });
    if (state.colorDistinction) a.push({ key: 'colorDistinction', label: 'Color distinction' });
    if (state.reposition) a.push({ key: 'reposition', label: `Content ${state.reposition}` });
    return a;
  }
  function activeSimulations() {
    const a = [];
    if (state.colorMode) a.push({ key: 'colorMode', label: state.colorMode, intensityKey: 'colorMode' });
    if (state.zoom === 'center') a.push({ key: 'zoom', label: 'Central field loss', intensityKey: 'zoom' });
    if (state.zoom === 'peripheral') a.push({ key: 'zoom', label: 'Peripheral field loss', intensityKey: 'zoom' });
    if (state.zoom === 'full') a.push({ key: 'zoom', label: 'Magnified', intensityKey: 'zoom' });
    if (state.hemianopia) a.push({ key: 'hemianopia', label: `Hemianopia (${state.hemianopia})` });
    if (state.blur) a.push({ key: 'blur', label: 'Cataracts', intensityKey: 'blur' });
    if (state.invertColors && !state.darkMode) a.push({ key: 'invertColors', label: 'Inverted', intensityKey: 'invertColors' });
    return a;
  }

  function response() {
    return {
      state,
      canUndo: undoStack.length > 0,
      adaptations: activeAdaptations(),
      simulations: activeSimulations(),
      lastSimplify,
      reading: tts.active,
    };
  }

  function mergeCommand(cmd) {
    for (const k of MERGE_KEYS) {
      const v = cmd[k];
      if (v === null || v === undefined) continue;
      if (k === 'reposition' && v === 'center') { state[k] = null; continue; }
      state[k] = v;
    }
    if (cmd.intensities) state.intensities = { ...state.intensities, ...cmd.intensities };
  }

  // ---- Persisted state load + cross-tab sync ------------------------------
  chrome.storage.local.get('vvState', (data) => {
    if (!data || !data.vvState) return;
    state = { ...defaultState(), ...data.vvState, intensities: { ...DEFAULT_INTENSITIES, ...(data.vvState.intensities || {}) } };
    applyAll();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.vvState) return;
    const ns = changes.vvState.newValue;
    if (!ns || JSON.stringify(ns) === JSON.stringify(state)) return;
    state = { ...defaultState(), ...ns, intensities: { ...DEFAULT_INTENSITIES, ...(ns.intensities || {}) } };
    applyAll();
  });

  // ---- Microphone port (recognition runs here at page origin) -------------
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'voicevision-mic') return;
    let recognition = null;
    port.onMessage.addListener((msg) => {
      if (msg.type === 'STOP') { recognition?.stop(); return; }
      if (msg.type !== 'START') return;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { port.postMessage({ type: 'error', error: 'unsupported' }); return; }
      recognition = new SR();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognition.onstart = () => port.postMessage({ type: 'start' });
      recognition.onend = () => port.postMessage({ type: 'end' });
      recognition.onerror = (e) => port.postMessage({ type: 'error', error: e.error });
      recognition.onresult = (e) => port.postMessage({ type: 'result', transcript: e.results[0][0].transcript });
      recognition.start();
    });
    port.onDisconnect.addListener(() => recognition?.stop());
  });

  // ---- Message router -----------------------------------------------------
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
      case 'GET_STATE':
        sendResponse(response());
        return;
      case 'APPLY_COMMAND': {
        const cmd = message.command || {};
        if (cmd.reset) { resetAll(); }
        else if (cmd.undo) { doUndo(); }
        else if (cmd.readAloud) { handleRead(cmd.readAloud); }
        else { pushUndo(); mergeCommand(cmd); applyAll(); }
        persistState();
        sendResponse(response());
        return;
      }
      case 'UNDO':
        doUndo(); persistState(); sendResponse(response()); return;
      case 'RESET':
        resetAll(); persistState(); sendResponse(response()); return;
      case 'READ_ALOUD':
        handleRead(message.action); sendResponse(response()); return;
      case 'TOGGLE_FILTER': {
        pushUndo();
        const key = message.key;
        const nullable = ['colorMode', 'zoom', 'hemianopia', 'brightness', 'reposition', 'textScale', 'lineSpacing', 'letterSpacing', 'paraSpacing'];
        state[key] = nullable.includes(key) ? null : false;
        applyAll(); persistState(); sendResponse(response()); return;
      }
      case 'SET_INTENSITY': {
        const { key, value } = message;
        state = key === 'brightness' ? { ...state, brightness: value } : { ...state, intensities: { ...state.intensities, [key]: value } };
        applyAll(); persistState(); sendResponse(response()); return;
      }
      default:
        return;
    }
  });

  function doUndo() {
    if (!undoStack.length) return;
    state = undoStack.pop();
    applyAll();
  }

  function handleRead(action) {
    if (action === 'start') startReading();
    else if (action === 'stop') stopReading();
    else if (action === 'pause') pauseReading();
    else if (action === 'resume') resumeReading();
  }
})();
