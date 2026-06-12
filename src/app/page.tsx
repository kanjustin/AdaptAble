'use client';
import { useState } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import { ActiveModes } from '@/components/ActiveModes';
import { applyFilters, resetFilters } from '@/lib/filters';
import { AccessibilityCommand, FilterIntensities, FilterState, defaultFilterState } from '@/types';

const SUPPORTED_ADAPTATIONS = [
  { category: 'Color Vision', items: [
    { label: 'Deuteranopia', desc: 'Red-green (most common)', key: 'colorMode', value: 'deuteranopia' },
    { label: 'Protanopia', desc: 'Red weakness', key: 'colorMode', value: 'protanopia' },
    { label: 'Tritanopia', desc: 'Blue-yellow', key: 'colorMode', value: 'tritanopia' },
    { label: 'Achromatopsia', desc: 'Full grayscale', key: 'colorMode', value: 'achromatopsia' },
  ]},
  { category: 'Vision Conditions', items: [
    { label: 'Macular Degeneration', desc: 'Central vision loss', key: 'zoom', value: 'center' },
    { label: 'Tunnel Vision', desc: 'Peripheral vision loss', key: 'zoom', value: 'peripheral' },
    { label: 'Low Vision', desc: 'Full page magnification', key: 'zoom', value: 'full' },
    { label: 'Cataracts', desc: 'Boosts contrast & brightness', key: 'blur', value: true },
    { label: 'Hemianopia (Left)', desc: 'Left visual field loss', key: 'hemianopia', value: 'left' },
    { label: 'Hemianopia (Right)', desc: 'Right visual field loss', key: 'hemianopia', value: 'right' },
  ]},
  { category: 'Display Comfort', items: [
    { label: 'Dark Mode', desc: 'Dark background for comfort', key: 'darkMode', value: true },
    { label: 'High Contrast', desc: 'Boosts contrast 150%', key: 'highContrast', value: true },
    { label: 'Warm Tone', desc: 'Reduces blue light', key: 'warmTone', value: true },
    { label: 'Invert Colors', desc: 'Full color inversion', key: 'invertColors', value: true },
    { label: 'Light Sensitivity', desc: 'Dims the page without inverting', key: 'dimOverlay', value: true },
    { label: 'Bold Text', desc: 'Thicker text for astigmatism/presbyopia', key: 'boldText', value: true },
    { label: 'Reduce Motion', desc: 'Stops animations & autoplay video', key: 'reduceMotion', value: true },
  ]},
] as const;

export default function Home() {
  const [filterState, setFilterState] = useState<FilterState>(defaultFilterState);
  const [lastTranscript, setLastTranscript] = useState('');
  const [explanation, setExplanation] = useState('');
  const [history, setHistory] = useState<{ transcript: string; explanation: string }[]>([]);

  const handleCommand = (cmd: AccessibilityCommand) => {
    setExplanation(cmd.explanation || '');
    if (lastTranscript && cmd.explanation) {
      setHistory(prev => [{ transcript: lastTranscript, explanation: cmd.explanation }, ...prev].slice(0, 3));
    }

    if (cmd.reset) {
      setFilterState(defaultFilterState);
      resetFilters();
      return;
    }

    setFilterState(prev => {
      const merge = <T,>(val: T | null | undefined, fallback: T): T =>
        val !== null && val !== undefined ? val : fallback;

      const next: FilterState = {
        colorMode: merge(cmd.colorMode, prev.colorMode),
        darkMode: merge(cmd.darkMode, prev.darkMode),
        highContrast: merge(cmd.highContrast, prev.highContrast),
        brightness: merge(cmd.brightness, prev.brightness),
        warmTone: merge(cmd.warmTone, prev.warmTone),
        invertColors: merge(cmd.invertColors, prev.invertColors),
        blur: merge(cmd.blur, prev.blur),
        hemianopia: merge(cmd.hemianopia, prev.hemianopia),
        zoom: merge(cmd.zoom, prev.zoom),
        dimOverlay: merge(cmd.dimOverlay, prev.dimOverlay),
        boldText: merge(cmd.boldText, prev.boldText),
        reduceMotion: merge(cmd.reduceMotion, prev.reduceMotion),
        intensities: cmd.intensities ? { ...prev.intensities, ...cmd.intensities } : prev.intensities,
      };
      applyFilters(next);
      return next;
    });
  };

  const handleRemove = (key: string) => {
    setFilterState(prev => {
      const next = { ...prev };
      if (key === 'colorMode') next.colorMode = null;
      else if (key === 'darkMode') next.darkMode = false;
      else if (key === 'highContrast') next.highContrast = false;
      else if (key === 'warmTone') next.warmTone = false;
      else if (key === 'invertColors') next.invertColors = false;
      else if (key === 'brightness') next.brightness = null;
      else if (key === 'zoom') next.zoom = null;
      else if (key === 'blur') next.blur = false;
      else if (key === 'hemianopia') next.hemianopia = null;
      else if (key === 'dimOverlay') next.dimOverlay = false;
      else if (key === 'boldText') next.boldText = false;
      else if (key === 'reduceMotion') next.reduceMotion = false;
      applyFilters(next);
      return next;
    });
  };

  const handleIntensityChange = (key: keyof FilterIntensities, value: number) => {
    setFilterState(prev => {
      const next: FilterState = { ...prev, intensities: { ...prev.intensities, [key]: value } };
      applyFilters(next);
      return next;
    });
  };

  const handleReset = () => {
    setFilterState(defaultFilterState);
    resetFilters();
    setExplanation('All filters cleared.');
  };

  type ToggleableKey = Exclude<keyof FilterState, 'brightness' | 'intensities'>;
  type ToggleableValue = string | boolean;

  const isActive = (key: ToggleableKey, value: ToggleableValue): boolean => {
    if (key === 'colorMode') return filterState.colorMode === value;
    if (key === 'zoom') return filterState.zoom === value;
    if (key === 'hemianopia') return filterState.hemianopia === value;
    return filterState[key] === value;
  };

  const toggleAdaptation = (key: ToggleableKey, value: ToggleableValue) => {
    setFilterState(prev => {
      const next = { ...prev };
      if (key === 'colorMode') next.colorMode = (prev.colorMode === value ? null : value) as FilterState['colorMode'];
      else if (key === 'zoom') next.zoom = (prev.zoom === value ? null : value) as FilterState['zoom'];
      else if (key === 'hemianopia') next.hemianopia = (prev.hemianopia === value ? null : value) as FilterState['hemianopia'];
      else if (key === 'darkMode') next.darkMode = !prev.darkMode;
      else if (key === 'highContrast') next.highContrast = !prev.highContrast;
      else if (key === 'warmTone') next.warmTone = !prev.warmTone;
      else if (key === 'invertColors') next.invertColors = !prev.invertColors;
      else if (key === 'blur') next.blur = !prev.blur;
      else if (key === 'dimOverlay') next.dimOverlay = !prev.dimOverlay;
      else if (key === 'boldText') next.boldText = !prev.boldText;
      else if (key === 'reduceMotion') next.reduceMotion = !prev.reduceMotion;
      applyFilters(next);
      return next;
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            AI-Powered Accessibility
          </div>
          <h1 className="text-5xl font-bold tracking-tight bg-gradient-to-r from-gray-900 via-blue-900 to-indigo-800 bg-clip-text text-transparent">
            VoiceVision
          </h1>
          <p className="text-gray-500 mt-2 text-lg">
            Speak your visual needs. AI adapts the screen instantly.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px]">
            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            Free tier: 20 voice requests/day — use sidebar buttons for unlimited access
          </div>
        </div>

        {/* Main layout: Control card + Supported adaptations sidebar */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left: Control Card */}
          <div className="flex-1 max-w-lg mx-auto lg:mx-0 w-full">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-white/60 p-8 space-y-6">
              <div className="flex justify-center">
                <VoiceButton onCommand={handleCommand} onTranscript={setLastTranscript} currentState={filterState} />
              </div>

              {(lastTranscript || explanation) && (
                <div className="space-y-2 animate-fade-in-up">
                  {lastTranscript && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.671 1.09-.085 2.17-.207 3.238-.364 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.4 48.4 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                      </svg>
                      <p className="text-sm text-gray-600">&ldquo;{lastTranscript}&rdquo;</p>
                    </div>
                  )}
                  {explanation && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <svg className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-emerald-700 font-medium">{explanation}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <ActiveModes state={filterState} onRemove={handleRemove} onReset={handleReset} onIntensityChange={handleIntensityChange} />
              </div>
            </div>

            {/* Command History */}
            {history.length > 0 && (
              <div className="mt-4 px-4 space-y-1">
                {history.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="truncate">&ldquo;{h.transcript}&rdquo; — {h.explanation}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Supported Adaptations */}
          <div className="w-full lg:w-72 shrink-0">
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-gray-200/60 p-5 space-y-4 sticky top-6">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h2 className="text-sm font-semibold text-gray-700">Supported Adaptations</h2>
              </div>
              <p className="text-[11px] text-gray-400 leading-relaxed -mt-2">
                Just describe how you see — AI figures out what to apply.
              </p>
              {SUPPORTED_ADAPTATIONS.map(group => (
                <div key={group.category}>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.category}</p>
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const active = isActive(item.key, item.value);
                      return (
                        <button
                          key={item.label}
                          onClick={() => toggleAdaptation(item.key, item.value)}
                          className={`w-full flex items-center justify-between gap-2 py-1.5 px-2.5 rounded-lg text-left transition-all ${
                            active
                              ? 'bg-blue-50 border border-blue-200 shadow-sm'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <span className={`text-xs font-medium ${active ? 'text-blue-700' : 'text-gray-700'}`}>{item.label}</span>
                          <span className={`text-[10px] shrink-0 ${active ? 'text-blue-500' : 'text-gray-400'}`}>
                            {active ? 'ON' : item.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  <span className="font-medium text-gray-500">Natural language:</span> Say things like
                  &ldquo;everything is too bright&rdquo;,
                  &ldquo;I can&apos;t tell red from green&rdquo;, or
                  &ldquo;my peripheral vision is gone&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Test Content Panel */}
      <div className="max-w-6xl mx-auto px-4 pb-16 mt-8">
        <div className="rounded-2xl border border-gray-200/60 bg-white/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center">
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <span className="text-xs font-medium text-gray-400 ml-2">Test Content — filters apply here</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Color Perception Test</p>
              <div className="flex gap-3">
                {[
                  { color: '#ef4444', label: 'Red' },
                  { color: '#22c55e', label: 'Green' },
                  { color: '#3b82f6', label: 'Blue' },
                  { color: '#eab308', label: 'Yellow' },
                  { color: '#f97316', label: 'Orange' },
                  { color: '#a855f7', label: 'Purple' },
                ].map(({ color, label }) => (
                  <div key={color} className="flex flex-col items-center gap-1.5">
                    <div
                      className="w-14 h-14 rounded-xl shadow-sm border border-black/5 transition-transform hover:scale-110"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[10px] text-gray-400 font-medium">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Image Test</p>
                <img
                  src="https://picsum.photos/400/200?random=1"
                  alt="Test image"
                  className="w-full rounded-xl shadow-sm border border-black/5"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Gradient Spectrum</p>
                  <div
                    className="h-14 rounded-xl shadow-sm border border-black/5"
                    style={{ background: 'linear-gradient(to right, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #8b5cf6)' }}
                  />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Contrast Ladder</p>
                  <div className="space-y-1">
                    <div className="h-3 rounded bg-gray-900" />
                    <div className="h-3 rounded bg-gray-600" />
                    <div className="h-3 rounded bg-gray-400" />
                    <div className="h-3 rounded bg-gray-200" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Text Readability</p>
              <div className="space-y-2 p-4 rounded-xl bg-gray-50/80 border border-gray-100">
                <p className="text-2xl font-bold text-gray-900">The quick brown fox jumps over the lazy dog</p>
                <p className="text-base text-gray-700">Body text at standard weight — should remain crisp in all modes.</p>
                <p className="text-sm text-gray-400">Small caption text — tests low-contrast readability and accessibility thresholds.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
