'use client';
import { FilterState } from '@/types';

interface Props {
  state: FilterState;
  onRemove: (key: string) => void;
  onReset: () => void;
}

const MODE_LABELS: Record<string, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Grayscale',
};

const ZOOM_LABELS: Record<string, { label: string; icon: string }> = {
  center: { label: 'Macular Degeneration', icon: '🔍' },
  peripheral: { label: 'Tunnel Vision', icon: '🔭' },
  full: { label: 'Full Zoom', icon: '🔎' },
};

export function ActiveModes({ state, onRemove, onReset }: Props) {
  const active: { label: string; icon: string; key: string }[] = [];
  if (state.colorMode) active.push({ label: MODE_LABELS[state.colorMode], icon: state.colorMode === 'achromatopsia' ? '⚫' : '🎨', key: 'colorMode' });
  if (state.darkMode) active.push({ label: 'Dark Mode', icon: '🌙', key: 'darkMode' });
  if (state.highContrast) active.push({ label: 'High Contrast', icon: '◐', key: 'highContrast' });
  if (state.warmTone) active.push({ label: 'Warm Tone', icon: '🔆', key: 'warmTone' });
  if (state.invertColors) active.push({ label: 'Inverted', icon: '🔄', key: 'invertColors' });
  if (state.brightness !== null) active.push({ label: `Brightness ${Math.round(state.brightness * 100)}%`, icon: '☀️', key: 'brightness' });
  if (state.zoom) active.push({ ...ZOOM_LABELS[state.zoom], key: 'zoom' });

  if (!active.length) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        No filters active — speak or tap an adaptation
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((mode, i) => (
        <span
          key={mode.key}
          className="group inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 text-blue-700 rounded-full text-xs font-medium animate-slide-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="text-sm leading-none">{mode.icon}</span>
          {mode.label}
          <button
            onClick={() => onRemove(mode.key)}
            className="ml-0.5 w-5 h-5 rounded-full flex items-center justify-center text-blue-400 hover:bg-red-100 hover:text-red-500 transition-colors"
            aria-label={`Remove ${mode.label}`}
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}
      {active.length > 1 && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
