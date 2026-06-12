import { FilterState } from '@/types';

// RGB coefficients (3x3) for each color-blindness simulation, Chrome Blink linearRGB values.
// feColorMatrix's alpha column/row is fixed (0,0,0,1,0) and appended separately.
const COLOR_MATRICES: Record<'deuteranopia' | 'protanopia' | 'tritanopia', number[][]> = {
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

const IDENTITY: number[][] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

// Linearly interpolate between the identity matrix and the full-deficiency matrix.
// t=0 → normal vision, t=1 → full simulation. Lets "mild deuteranopia" render as
// a partial blend instead of only ever being all-or-nothing.
function blendMatrixValues(matrix: number[][], t: number): string {
  const rows = matrix.map((row, i) =>
    row.map((v, j) => {
      const identityVal = IDENTITY[i][j];
      return (identityVal * (1 - t) + v * t).toFixed(3);
    })
  );
  return [...rows.map(row => `${row.join(' ')} 0 0`), '0 0 0 1 0'].join('\n');
}

// Re-writes the feColorMatrix `values` attribute for each color-blindness filter
// to reflect the current severity. Must run before the filter is referenced via url(#id).
export function updateColorMatrices(intensity: number): void {
  for (const mode of Object.keys(COLOR_MATRICES) as Array<keyof typeof COLOR_MATRICES>) {
    const el = document.getElementById(`${mode}-matrix`);
    if (el) el.setAttribute('values', blendMatrixValues(COLOR_MATRICES[mode], intensity));
  }
}

export function buildFilterString(state: FilterState): string {
  const { intensities } = state;
  const parts: string[] = [];

  if (state.colorMode === 'achromatopsia') {
    parts.push(`grayscale(${Math.round(intensities.colorMode * 100)}%)`);
  } else if (state.colorMode) {
    parts.push(`url(#${state.colorMode})`);
  }

  if (state.darkMode) {
    parts.push(`invert(${Math.round(93 * intensities.darkMode)}%) hue-rotate(180deg)`);
  }
  if (state.invertColors && !state.darkMode) {
    parts.push(`invert(${Math.round(100 * intensities.invertColors)}%) hue-rotate(180deg)`);
  }
  if (state.warmTone) parts.push(`sepia(${Math.round(25 * intensities.warmTone)}%)`);
  if (state.highContrast) parts.push(`contrast(${Math.round(100 + 50 * intensities.highContrast)}%)`);
  // Cataracts/low vision: the page is already hazy to the user, so we boost contrast
  // and brightness to cut through the haze rather than adding more blur on top.
  if (state.blur) {
    parts.push(`contrast(${Math.round(100 + 60 * intensities.blur)}%)`);
    parts.push(`brightness(${Math.round(100 + 15 * intensities.blur)}%)`);
  }
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);
  if (state.darkMode && state.brightness === null) {
    parts.push(`brightness(${(1 - 0.2 * intensities.darkMode).toFixed(2)})`);
  }

  return parts.join(' ') || 'none';
}

export function applyFilters(state: FilterState): void {
  updateColorMatrices(state.intensities.colorMode);

  const root = document.documentElement;
  // Safari (incl. iOS) does not render CSS `filter` set on <html> — apply to <body> instead.
  document.body.style.filter = buildFilterString(state);

  if (state.darkMode) {
    root.style.colorScheme = 'dark';
    root.classList.add('vv-dark');
  } else {
    root.style.colorScheme = '';
    root.classList.remove('vv-dark');
  }

  if (state.invertColors && !state.darkMode) {
    root.classList.add('vv-invert');
  } else {
    root.classList.remove('vv-invert');
  }

  applyZoom(state.zoom, state.intensities.zoom);
  applyHemianopia(state.hemianopia);
  applyDimOverlay(state.dimOverlay, state.intensities.dimOverlay);
  applyBoldText(state.boldText);
  applyReduceMotion(state.reduceMotion);
}

// Photophobia/migraine: a non-inverting dark overlay that dims the page without
// flipping colors (unlike darkMode's invert+hue-rotate).
export function applyDimOverlay(active: boolean, intensity: number): void {
  let overlay = document.getElementById('vv-dim-overlay');

  if (!active) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vv-dim-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999997;pointer-events:none;background:black;';
    document.body.appendChild(overlay);
  }
  overlay.style.opacity = (0.15 + intensity * 0.45).toFixed(2);
}

const BOLD_TEXT_CSS = `body, p, span, a, li, h1, h2, h3, h4, h5, h6, label, button, td, th, input, textarea {
  font-weight: 600 !important;
}`;

// Astigmatism/presbyopia: thicker text is easier to resolve when edges look smeared.
export function applyBoldText(active: boolean): void {
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
export function applyReduceMotion(active: boolean): void {
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

  document.querySelectorAll('video[autoplay]').forEach(v => (v as HTMLVideoElement).pause());
}

// Uses the CSS `zoom` property (not `transform: scale`) for full-page magnification —
// `zoom` reflows layout like the browser's native ctrl/cmd+ zoom, so scrollbars and
// scroll position stay correct. `transform: scale` on body breaks scroll bounds.
export function applyZoom(zoom: FilterState['zoom'], intensity: number): void {
  let overlay = document.getElementById('vv-zoom-overlay');

  if (zoom === 'full') {
    if (overlay) overlay.remove();
    const root = document.documentElement as HTMLElement & { style: { zoom?: string } };
    root.style.zoom = `${Math.round(100 + intensity * 150)}%`;
    return;
  }

  (document.documentElement as HTMLElement & { style: { zoom?: string } }).style.zoom = '';

  if (!zoom) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vv-zoom-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;pointer-events:none;';
    document.body.appendChild(overlay);
  }

  // Higher intensity = smaller remaining visual field = more advanced vision loss.
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
export function applyHemianopia(side: FilterState['hemianopia']): void {
  let overlay = document.getElementById('vv-hemianopia-overlay');

  if (!side) {
    if (overlay) overlay.remove();
    return;
  }

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vv-hemianopia-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999998;pointer-events:none;';
    document.body.appendChild(overlay);
  }

  const gradientDir = side === 'left' ? 'to right' : 'to left';
  overlay.innerHTML = `<div style="position:absolute;inset:0;width:55%;${side === 'right' ? 'right:0;left:auto;' : 'left:0;'}
    background:linear-gradient(${gradientDir}, black 80%, transparent 100%);"></div>`;
}

export function resetFilters(): void {
  const root = document.documentElement as HTMLElement & { style: { zoom?: string } };
  document.body.style.filter = 'none';
  root.style.colorScheme = '';
  root.style.zoom = '';
  root.classList.remove('vv-dark', 'vv-invert');
  const zoomOverlay = document.getElementById('vv-zoom-overlay');
  if (zoomOverlay) zoomOverlay.remove();
  const hemiOverlay = document.getElementById('vv-hemianopia-overlay');
  if (hemiOverlay) hemiOverlay.remove();
  const dimOverlay = document.getElementById('vv-dim-overlay');
  if (dimOverlay) dimOverlay.remove();
  const boldTextStyle = document.getElementById('vv-bold-text-style');
  if (boldTextStyle) boldTextStyle.remove();
  const reduceMotionStyle = document.getElementById('vv-reduce-motion-style');
  if (reduceMotionStyle) reduceMotionStyle.remove();
}
