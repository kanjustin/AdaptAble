import { FilterState } from '@/types';

export function buildFilterString(state: FilterState): string {
  const parts: string[] = [];
  if (state.colorMode === 'achromatopsia') {
    parts.push('grayscale(100%)');
  } else if (state.colorMode) {
    parts.push(`url(#${state.colorMode})`);
  }
  if (state.invertColors) parts.push('invert(100%) hue-rotate(180deg)');
  if (state.warmTone) parts.push('sepia(25%)');
  if (state.highContrast) parts.push('contrast(150%)');
  if (state.brightness !== null) parts.push(`brightness(${state.brightness})`);
  return parts.join(' ') || 'none';
}

export function applyFilters(state: FilterState): void {
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

export function resetFilters(): void {
  document.documentElement.style.filter = 'none';
  document.documentElement.style.colorScheme = '';
  document.body.style.backgroundColor = '';
  document.body.style.color = '';
}
