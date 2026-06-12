(function () {
  if (window.__voicevisionInjected) return;
  window.__voicevisionInjected = true;

  const FILTER_IDS = {
    deuteranopia: 'vv-deuteranopia',
    protanopia: 'vv-protanopia',
    tritanopia: 'vv-tritanopia',
  };

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
          <feColorMatrix type="matrix" values="
            0.367  0.861 -0.228  0  0
            0.280  0.673  0.047  0  0
           -0.012  0.043  0.969  0  0
            0      0      0      1  0"/>
        </filter>
        <filter id="${FILTER_IDS.protanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix type="matrix" values="
            0.152  0.848  0      0  0
            0.114  0.886  0      0  0
            0      0.094  0.906  0  0
            0      0      0      1  0"/>
        </filter>
        <filter id="${FILTER_IDS.tritanopia}" color-interpolation-filters="linearRGB">
          <feColorMatrix type="matrix" values="
            1      0.168 -0.168  0  0
            0      0.920  0.080  0  0
            0      0.923  0.077  0  0
            0      0      0      1  0"/>
        </filter>
      </defs>`;
    document.body.appendChild(svg);
  }

  injectFilterDefs();

  let state = {
    colorMode: null,
    darkMode: false,
    highContrast: false,
    brightness: null,
    warmTone: false,
    invertColors: false,
    zoom: null,
  };

  // Mirrors src/lib/filters.ts — CSS `filter` is not additive, compose into one string.
  // Dark mode uses invert+hue-rotate (not a body background swap) so it works on
  // arbitrary sites regardless of how deeply they set their own background colors.
  function buildFilterString(s) {
    const parts = [];
    if (s.colorMode === 'achromatopsia') parts.push('grayscale(100%)');
    else if (s.colorMode) parts.push(`url(#${FILTER_IDS[s.colorMode]})`);
    if (s.darkMode) parts.push('invert(93%) hue-rotate(180deg)');
    if (s.invertColors && !s.darkMode) parts.push('invert(100%) hue-rotate(180deg)');
    if (s.warmTone) parts.push('sepia(25%)');
    if (s.highContrast) parts.push('contrast(150%)');
    if (s.brightness !== null) parts.push(`brightness(${s.brightness})`);
    if (s.darkMode && s.brightness === null) parts.push('brightness(0.8)');
    return parts.join(' ') || 'none';
  }

  function applyFilters() {
    const root = document.documentElement;
    root.style.filter = buildFilterString(state);
    root.style.colorScheme = state.darkMode ? 'dark' : '';
  }

  // Mirrors src/lib/filters.ts applyZoom — center/peripheral use a fixed SVG
  // vignette overlay, full re-scales the page.
  function applyZoom(zoom) {
    let overlay = document.getElementById('vv-zoom-overlay');

    if (zoom === 'full') {
      if (overlay) overlay.remove();
      document.body.style.transform = 'scale(1.5)';
      document.body.style.transformOrigin = 'top center';
      document.body.style.overflow = 'auto';
      return;
    }

    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
    document.body.style.overflow = '';

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

    if (zoom === 'center') {
      overlay.innerHTML = `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="vv-mac-grad" cx="50%" cy="50%" r="30%">
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
          <radialGradient id="vv-tunnel-grad" cx="50%" cy="50%" r="35%">
            <stop offset="0%" stop-color="black" stop-opacity="0"/>
            <stop offset="70%" stop-color="black" stop-opacity="0.5"/>
            <stop offset="100%" stop-color="black" stop-opacity="0.92"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#vv-tunnel-grad)"/>
      </svg>`;
    }
  }

  function resetAll() {
    state = {
      colorMode: null,
      darkMode: false,
      highContrast: false,
      brightness: null,
      warmTone: false,
      invertColors: false,
      zoom: null,
    };
    const root = document.documentElement;
    root.style.filter = 'none';
    root.style.colorScheme = '';
    applyZoom(null);
  }

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
          zoom: cmd.zoom ?? state.zoom,
        };
        applyFilters();
        applyZoom(state.zoom);
      }
      sendResponse(state);
      return;
    }
  });
})();
