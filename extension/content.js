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
  };

  // Mirrors src/lib/filters.ts — CSS `filter` is not additive, compose into one string.
  function buildFilterString(s) {
    const parts = [];
    if (s.colorMode === 'achromatopsia') parts.push('grayscale(100%)');
    else if (s.colorMode) parts.push(`url(#${FILTER_IDS[s.colorMode]})`);
    if (s.invertColors) parts.push('invert(100%) hue-rotate(180deg)');
    if (s.warmTone) parts.push('sepia(25%)');
    if (s.highContrast) parts.push('contrast(150%)');
    if (s.brightness !== null) parts.push(`brightness(${s.brightness})`);
    return parts.join(' ') || 'none';
  }

  function applyFilters() {
    const root = document.documentElement;
    root.style.filter = buildFilterString(state);
    if (state.darkMode) {
      root.style.colorScheme = 'dark';
      document.body.style.backgroundColor = '#0f0f0f';
      document.body.style.color = '#f0f0f0';
    } else {
      root.style.colorScheme = '';
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
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
    };
    const root = document.documentElement;
    root.style.filter = 'none';
    root.style.colorScheme = '';
    document.body.style.backgroundColor = '';
    document.body.style.color = '';
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
        };
        applyFilters();
      }
      sendResponse(state);
      return;
    }
  });
})();
