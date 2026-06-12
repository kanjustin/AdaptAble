(function () {
  if (window.__voicevisionInjected) return;
  window.__voicevisionInjected = true;

  const FILTER_IDS = {
    deuteranopia: 'vv-deuteranopia',
    protanopia: 'vv-protanopia',
    tritanopia: 'vv-tritanopia',
  };

  // RGB coefficients (3x3) for each color-blindness simulation, Chrome Blink linearRGB values.
  const COLOR_MATRICES = {
    deuteranopia: [
      [0.367, 0.861, -0.228],
      [0.280, 0.673, 0.047],
      [-0.012, 0.043, 0.969],
    ],
    protanopia: [
      [0.152, 0.848, 0],
      [0.114, 0.886, 0],
      [0, 0.094, 0.906],
    ],
    tritanopia: [
      [1, 0.168, -0.168],
      [0, 0.920, 0.080],
      [0, 0.923, 0.077],
    ],
  };

  const IDENTITY = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  // Linearly interpolate between identity and full-deficiency matrix. t=0 → normal, t=1 → full.
  function blendMatrixValues(matrix, t) {
    const rows = matrix.map((row, i) =>
      row.map((v, j) => (IDENTITY[i][j] * (1 - t) + v * t).toFixed(3))
    );
    return [...rows.map((row) => `${row.join(' ')} 0 0`), '0 0 0 1 0'].join('\n');
  }

  function updateColorMatrices(intensity) {
    for (const mode of Object.keys(COLOR_MATRICES)) {
      const el = document.getElementById(`${FILTER_IDS[mode]}-matrix`);
      if (el) el.setAttribute('values', blendMatrixValues(COLOR_MATRICES[mode], intensity));
    }
  }

  // Inject the SVG colour-matrix defs once. Chrome Blink renderer values —
  // color-interpolation-filters="linearRGB" required or the matrix math runs in sRGB.
  function injectFilterDefs() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.position = 'absolute';
    svg.style.width = '0';
    svg.style.height = '0';
    svg.style.overflow = 'hidden';
    svg.innerHTML = `
      <defs>
        <filter id="${FILTER_IDS.deuteranopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.deuteranopia}-matrix" type="matrix" values="
            0.367  0.861 -0.228  0  0
            0.280  0.673  0.047  0  0
           -0.012  0.043  0.969  0  0
            0      0      0      1  0"/>
        </filter>
        <filter id="${FILTER_IDS.protanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.protanopia}-matrix" type="matrix" values="
            0.152  0.848  0      0  0
            0.114  0.886  0      0  0
            0      0.094  0.906  0  0
            0      0      0      1  0"/>
        </filter>
        <filter id="${FILTER_IDS.tritanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix id="${FILTER_IDS.tritanopia}-matrix" type="matrix" values="
            1      0.168 -0.168  0  0
            0      0.920  0.080  0  0
            0      0.923  0.077  0  0
            0      0      0      1  0"/>
        </filter>
      </defs>`;
    document.body.appendChild(svg);
  }

  injectFilterDefs();

  const DEFAULT_INTENSITIES = {
    colorMode: 1,
    darkMode: 1,
    highContrast: 1,
    warmTone: 1,
    invertColors: 1,
    blur: 0.5,
    zoom: 0.5,
    dimOverlay: 0.5,
  };

  let state = {
    colorMode: null,
    darkMode: false,
    highContrast: false,
    brightness: null,
    warmTone: false,
    invertColors: false,
    blur: false,
    hemianopia: null,
    zoom: null,
    dimOverlay: false,
    boldText: false,
    reduceMotion: false,
    intensities: { ...DEFAULT_INTENSITIES },
  };

  // Mirrors src/lib/filters.ts — CSS `filter` is not additive, compose into one string.
  // Dark mode uses invert+hue-rotate (not a body background swap) so it works on
  // arbitrary sites regardless of how deeply they set their own background colors.
  function buildFilterString(s) {
    const { intensities } = s;
    const parts = [];
    if (s.colorMode === 'achromatopsia') parts.push(`grayscale(${Math.round(intensities.colorMode * 100)}%)`);
    else if (s.colorMode) parts.push(`url(#${FILTER_IDS[s.colorMode]})`);
    if (s.darkMode) parts.push(`invert(${Math.round(93 * intensities.darkMode)}%) hue-rotate(180deg)`);
    if (s.invertColors && !s.darkMode) parts.push(`invert(${Math.round(100 * intensities.invertColors)}%) hue-rotate(180deg)`);
    if (s.warmTone) parts.push(`sepia(${Math.round(25 * intensities.warmTone)}%)`);
    if (s.highContrast) parts.push(`contrast(${Math.round(100 + 50 * intensities.highContrast)}%)`);
    // Cataracts/low vision: the page is already hazy to the user, so boost contrast
    // and brightness to cut through the haze rather than adding more blur on top.
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
    // Safari does not render CSS `filter` set on <html> — apply to <body> instead.
    document.body.style.filter = buildFilterString(state);
    document.documentElement.style.colorScheme = state.darkMode ? 'dark' : '';
  }

  // Mirrors src/lib/filters.ts applyZoom — CSS `zoom` (not transform: scale) for full
  // magnification so layout reflows and scroll position/bounds stay correct.
  function applyZoom(zoom, intensity) {
    let overlay = document.getElementById('vv-zoom-overlay');

    if (zoom === 'full') {
      if (overlay) overlay.remove();
      document.documentElement.style.zoom = `${Math.round(100 + intensity * 150)}%`;
      return;
    }

    document.documentElement.style.zoom = '';

    if (!zoom) {
      if (overlay) overlay.remove();
      return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-zoom-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(overlay);
    }

    const visibleRadius = Math.round(45 - intensity * 30); // 15%-45%
    const midRadius = Math.min(95, visibleRadius + 25);

    if (zoom === 'center') {
      overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vv-mac-grad" cx="50%" cy="50%" r="${visibleRadius}%">
            <stop offset="0%" stop-color="black" stop-opacity="0.7"/>
            <stop offset="60%" stop-color="black" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="black" stop-opacity="0"/>
          </radialGradient>
          <filter id="vv-mac-blur">
            <feGaussianBlur stdDeviation="3"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#vv-mac-grad)" filter="url(#vv-mac-blur)"/>
      </svg>`;
    } else if (zoom === 'peripheral') {
      overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vv-tunnel-grad" cx="50%" cy="50%" r="${midRadius}%">
            <stop offset="0%" stop-color="black" stop-opacity="0"/>
            <stop offset="${Math.max(10, visibleRadius)}%" stop-color="black" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#vv-tunnel-grad)"/>
      </svg>`;
    }
  }

  // Hemianopia: loss of one half of the visual field (common after stroke). A fixed,
  // pointer-events:none overlay over the affected half — does not block scroll/clicks.
  function applyHemianopia(side) {
    let overlay = document.getElementById('vv-hemianopia-overlay');

    if (!side) {
      if (overlay) overlay.remove();
      return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-hemianopia-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
      document.body.appendChild(overlay);
    }

    const gradientDir = side === 'left' ? 'to right' : 'to left';
    overlay.innerHTML = `<div style="position:absolute;inset:0;width:55%;${side === 'right' ? 'right:0;left:auto;' : 'left:0;'}
      background:linear-gradient(${gradientDir}, black 80%, transparent 100%);"></div>`;
  }

  // Photophobia/migraine: a non-inverting dark overlay that dims the page without
  // flipping colors (unlike darkMode's invert+hue-rotate).
  function applyDimOverlay(active, intensity) {
    let overlay = document.getElementById('vv-dim-overlay');

    if (!active) {
      if (overlay) overlay.remove();
      return;
    }

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'vv-dim-overlay';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483645;pointer-events:none;background:black;';
      document.body.appendChild(overlay);
    }
    overlay.style.opacity = (0.15 + intensity * 0.45).toFixed(2);
  }

  const BOLD_TEXT_CSS = `body, p, span, a, li, h1, h2, h3, h4, h5, h6, label, button, td, th, input, textarea {
    font-weight: 600 !important;
  }`;

  // Astigmatism/presbyopia: thicker text is easier to resolve when edges look smeared.
  function applyBoldText(active) {
    let style = document.getElementById('vv-bold-text-style');

    if (!active) {
      if (style) style.remove();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-bold-text-style';
      style.textContent = BOLD_TEXT_CSS;
      document.head.appendChild(style);
    }
  }

  const REDUCE_MOTION_CSS = `*, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }`;

  // Vestibular/motion sensitivity: kill animations/transitions and pause autoplay video.
  function applyReduceMotion(active) {
    let style = document.getElementById('vv-reduce-motion-style');

    if (!active) {
      if (style) style.remove();
      return;
    }

    if (!style) {
      style = document.createElement('style');
      style.id = 'vv-reduce-motion-style';
      style.textContent = REDUCE_MOTION_CSS;
      document.head.appendChild(style);
    }

    document.querySelectorAll('video[autoplay]').forEach((v) => v.pause());
  }

  // Re-run all visual effects from the current state — used after any state change.
  function applyAll() {
    applyFilters();
    applyZoom(state.zoom, state.intensities.zoom);
    applyHemianopia(state.hemianopia);
    applyDimOverlay(state.dimOverlay, state.intensities.dimOverlay);
    applyBoldText(state.boldText);
    applyReduceMotion(state.reduceMotion);
  }

  // Persist state to chrome.storage so it carries over to new tabs/pages, and other
  // open tabs pick it up via the onChanged listener below.
  function persistState() {
    chrome.storage.local.set({ vvState: state });
  }

  function resetAll() {
    state = {
      colorMode: null,
      darkMode: false,
      highContrast: false,
      brightness: null,
      warmTone: false,
      invertColors: false,
      blur: false,
      hemianopia: null,
      zoom: null,
      dimOverlay: false,
      boldText: false,
      reduceMotion: false,
      intensities: { ...DEFAULT_INTENSITIES },
    };
    const root = document.documentElement;
    document.body.style.filter = 'none';
    root.style.colorScheme = '';
    root.style.zoom = '';
    applyZoom(null, 0);
    applyHemianopia(null);
    applyDimOverlay(false, 0);
    applyBoldText(false);
    applyReduceMotion(false);
  }

  // Load persisted state on page load so filters set on another page/tab apply here too.
  chrome.storage.local.get('vvState', (data) => {
    if (!data.vvState) return;
    state = {
      ...state,
      ...data.vvState,
      intensities: { ...DEFAULT_INTENSITIES, ...(data.vvState.intensities ?? {}) },
    };
    applyAll();
  });

  // Pick up state changes made from other tabs.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.vvState) return;
    const newState = changes.vvState.newValue;
    if (!newState || JSON.stringify(newState) === JSON.stringify(state)) return;
    state = {
      ...newState,
      intensities: { ...DEFAULT_INTENSITIES, ...(newState.intensities ?? {}) },
    };
    applyAll();
  });

  // SpeechRecognition runs here (page origin) instead of the popup — chrome-extension://
  // popup origins can't hold a mic permission grant, but the page origin can (same as
  // the standalone website). Streamed to the popup over a port since recognition is async.
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'voicevision-mic') return;
    let recognition = null;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'STOP') {
        recognition?.stop();
        return;
      }
      if (msg.type !== 'START') return;

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        port.postMessage({ type: 'error', error: 'unsupported' });
        return;
      }

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

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_STATE') {
      sendResponse(state);
      return;
    }
    if (message.type === 'APPLY_COMMAND') {
      const cmd = message.command;
      if (cmd.reset) {
        resetAll();
      } else {
        state = {
          colorMode: cmd.colorMode ?? state.colorMode,
          darkMode: cmd.darkMode ?? state.darkMode,
          highContrast: cmd.highContrast ?? state.highContrast,
          brightness: cmd.brightness ?? state.brightness,
          warmTone: cmd.warmTone ?? state.warmTone,
          invertColors: cmd.invertColors ?? state.invertColors,
          blur: cmd.blur ?? state.blur,
          hemianopia: cmd.hemianopia ?? state.hemianopia,
          zoom: cmd.zoom ?? state.zoom,
          dimOverlay: cmd.dimOverlay ?? state.dimOverlay,
          boldText: cmd.boldText ?? state.boldText,
          reduceMotion: cmd.reduceMotion ?? state.reduceMotion,
          intensities: cmd.intensities ? { ...state.intensities, ...cmd.intensities } : state.intensities,
        };
        applyAll();
      }
      persistState();
      sendResponse(state);
      return;
    }
    // Turn a single active filter off (the × button in the popup).
    if (message.type === 'TOGGLE_FILTER') {
      const key = message.key;
      if (key === 'colorMode' || key === 'zoom' || key === 'hemianopia' || key === 'brightness') {
        state = { ...state, [key]: null };
      } else {
        state = { ...state, [key]: false };
      }
      applyAll();
      persistState();
      sendResponse(state);
      return;
    }
    // Adjust a filter's intensity slider in the popup.
    if (message.type === 'SET_INTENSITY') {
      const { key, value } = message;
      state = key === 'brightness'
        ? { ...state, brightness: value }
        : { ...state, intensities: { ...state.intensities, [key]: value } };
      applyAll();
      persistState();
      sendResponse(state);
      return;
    }
  });
})();
