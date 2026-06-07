'use client';
import { FilterState } from '@/types';

interface Props {
  state: FilterState;
  onReset: () => void;
}

const MODE_LABELS: Record<string, string> = {
  deuteranopia: 'Deuteranopia',
  protanopia: 'Protanopia',
  tritanopia: 'Tritanopia',
  achromatopsia: 'Grayscale',
};

const MODE_ICONS: Record<string, string> = {
  deuteranopia: '🔴🟢',
  protanopia: '🔴',
  tritanopia: '🔵🟡',
  achromatopsia: '⚫',
  'Dark Mode': '🌙',
  'High Contrast': '◐',
  'Warm Tone': '🔆',
  'Inverted': '🔄',
};

export function ActiveModes({ state, onReset }: Props) {
  const active: { label: string; icon: string }[] = [];
  if (state.colorMode) active.push({ label: MODE_LABELS[state.colorMode], icon: MODE_ICONS[state.colorMode] });
  if (state.darkMode) active.push({ label: 'Dark Mode', icon: '🌙' });
  if (state.highContrast) active.push({ label: 'High Contrast', icon: '◐' });
  if (state.warmTone) active.push({ label: 'Warm Tone', icon: '🔆' });
  if (state.invertColors) active.push({ label: 'Inverted', icon: '🔄' });
  if (state.brightness !== null) active.push({ label: `Brightness ${Math.round(state.brightness * 100)}%`, icon: '☀️' });

  if (!active.length) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        No filters active — try &ldquo;dark mode&rdquo; or &ldquo;red-green colorblind&rdquo;
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active.map((mode, i) => (
        <span
          key={mode.label}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 text-blue-700 rounded-full text-xs font-medium animate-slide-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <span className="text-sm leading-none">{mode.icon}</span>
          {mode.label}
        </span>
      ))}
      <button
        onClick={onReset}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
        Clear all
      </button>
    </div>
  );
}
