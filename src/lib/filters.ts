import { FilterState } from '@/types';

export function buildFilterString(state: FilterState): string {
  const parts: string[] = [];
  if (state.colorMode === 'achromatopsia') {
    parts.push('grayscale(100%)');
  } else if (state.colorMode) {
    parts.push(`url(#${state.colorMode})`);
  }
  if (state.darkMode) parts.push('invert(93%) hue-rotate(180deg)');
  if (state.invertColors && !state.darkMode) parts.push('invert(100%) hue-rotate(180deg)');
  if (state.warmTone) parts.push('sepia(25%)');
  if (state.highContrast) parts.push('contrast(150%)');
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);
  if (state.darkMode && state.brightness === null) parts.push('brightness(0.8)');
  return parts.join(' ') || 'none';
}

export function applyFilters(state: FilterState): void {
  const root = document.documentElement;
  root.style.filter = buildFilterString(state);

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

  applyZoom(state.zoom);
}

export function applyZoom(zoom: FilterState['zoom']): void {
  let overlay = document.getElementById('vv-zoom-overlay');

  if (!zoom) {
    if (overlay) overlay.remove();
    document.body.style.transform = '';
    document.body.style.transformOrigin = '';
    document.body.style.overflow = '';
    return;
  }

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

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'vv-zoom-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;pointer-events:none;';
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

export function resetFilters(): void {
  const root = document.documentElement;
  root.style.filter = 'none';
  root.style.colorScheme = '';
  root.classList.remove('vv-dark', 'vv-invert');
  document.body.style.transform = '';
  document.body.style.transformOrigin = '';
  document.body.style.overflow = '';
  const overlay = document.getElementById('vv-zoom-overlay');
  if (overlay) overlay.remove();
}
