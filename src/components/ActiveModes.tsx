'use client';
import { FilterIntensities, FilterState } from '@/types';

interface Props {
  state: FilterState;
  onRemove: (key: string) => void;
  onReset: () => void;
  onIntensityChange: (key: keyof FilterIntensities, value: number) => void;
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

const HEMIANOPIA_LABELS: Record<string, string> = {
  left: 'Hemianopia (Left)',
  right: 'Hemianopia (Right)',
};

interface ActiveMode {
  label: string;
  icon: string;
  key: string;
  intensityKey?: keyof FilterIntensities;
}

export function ActiveModes({ state, onRemove, onReset, onIntensityChange }: Props) {
  const active: ActiveMode[] = [];
  if (state.colorMode) {
    active.push({
      label: MODE_LABELS[state.colorMode],
      icon: state.colorMode === 'achromatopsia' ? '⚫' : '🎨',
      key: 'colorMode',
      intensityKey: 'colorMode',
    });
  }
  if (state.darkMode) active.push({ label: 'Dark Mode', icon: '🌙', key: 'darkMode', intensityKey: 'darkMode' });
  if (state.highContrast) active.push({ label: 'High Contrast', icon: '◐', key: 'highContrast', intensityKey: 'highContrast' });
  if (state.warmTone) active.push({ label: 'Warm Tone', icon: '🔆', key: 'warmTone', intensityKey: 'warmTone' });
  if (state.invertColors) active.push({ label: 'Inverted', icon: '🔄', key: 'invertColors', intensityKey: 'invertColors' });
  if (state.blur) active.push({ label: 'Cataracts (Clarity Boost)', icon: '🌗', key: 'blur', intensityKey: 'blur' });
  if (state.brightness !== null) active.push({ label: `Brightness ${Math.round(state.brightness * 100)}%`, icon: '☀️', key: 'brightness' });
  if (state.zoom) active.push({ ...ZOOM_LABELS[state.zoom], key: 'zoom', intensityKey: 'zoom' });
  if (state.hemianopia) active.push({ label: HEMIANOPIA_LABELS[state.hemianopia], icon: '🕶️', key: 'hemianopia' });
  if (state.dimOverlay) active.push({ label: 'Light Sensitivity Dimmer', icon: '🕯️', key: 'dimOverlay', intensityKey: 'dimOverlay' });
  if (state.boldText) active.push({ label: 'Bold Text', icon: '🔤', key: 'boldText' });
  if (state.reduceMotion) active.push({ label: 'Reduced Motion', icon: '🧘', key: 'reduceMotion' });

  if (!active.length) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
        <span className="w-2 h-2 rounded-full bg-gray-300" />
        No filters active — speak or tap an adaptation
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {active.map((mode, i) => (
        <div
          key={mode.key}
          className="flex flex-col gap-1.5 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200/50 rounded-xl animate-slide-in"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm leading-none">{mode.icon}</span>
            <span className="text-xs font-medium text-blue-700 flex-1">{mode.label}</span>
            <button
              onClick={() => onRemove(mode.key)}
              className="w-5 h-5 rounded-full flex items-center justify-center text-blue-400 hover:bg-red-100 hover:text-red-500 transition-colors"
              aria-label={`Remove ${mode.label}`}
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {mode.intensityKey && (
            <div className="flex items-center gap-2 pl-0.5">
              <span className="text-[10px] text-blue-400 uppercase tracking-wide w-12 shrink-0">Intensity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={state.intensities[mode.intensityKey]}
                onChange={e => onIntensityChange(mode.intensityKey!, Number(e.target.value))}
                className="flex-1 h-1.5 accent-blue-500 cursor-pointer"
                aria-label={`${mode.label} intensity`}
              />
              <span className="text-[10px] text-blue-500 font-medium w-8 text-right shrink-0">
                {Math.round(state.intensities[mode.intensityKey] * 100)}%
              </span>
            </div>
          )}
        </div>
      ))}
      {active.length > 1 && (
        <button
          onClick={onReset}
          className="self-start inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
