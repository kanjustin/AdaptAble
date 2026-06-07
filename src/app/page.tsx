'use client';
import { useState } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import { ActiveModes } from '@/components/ActiveModes';
import { applyFilters, resetFilters } from '@/lib/filters';
import { AccessibilityCommand, FilterState, defaultFilterState } from '@/types';

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
      const next: FilterState = {
        colorMode: cmd.colorMode ?? prev.colorMode,
        darkMode: cmd.darkMode ?? prev.darkMode,
        highContrast: cmd.highContrast ?? prev.highContrast,
        brightness: cmd.brightness ?? prev.brightness,
        warmTone: cmd.warmTone ?? prev.warmTone,
        invertColors: cmd.invertColors ?? prev.invertColors,
      };
      applyFilters(next);
      return next;
    });
  };

  const handleReset = () => {
    setFilterState(defaultFilterState);
    resetFilters();
    setExplanation('All filters cleared.');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Hero / Control Panel */}
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-8">
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
        </div>

        {/* Floating Control Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.12)] border border-white/60 p-8 space-y-6">
            {/* Voice Button */}
            <div className="flex justify-center">
              <VoiceButton onCommand={handleCommand} onTranscript={setLastTranscript} />
            </div>

            {/* Transcript + Explanation */}
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

            {/* Active Modes */}
            <div className="pt-2 border-t border-gray-100">
              <ActiveModes state={filterState} onReset={handleReset} />
            </div>
          </div>
        </div>

        {/* Command History */}
        {history.length > 0 && (
          <div className="max-w-md mx-auto mt-4">
            <div className="px-4 space-y-1">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400 animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
                  <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="truncate">&ldquo;{h.transcript}&rdquo; — {h.explanation}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Test Content Panel */}
      <div className="max-w-5xl mx-auto px-4 pb-16">
        <div className="rounded-2xl border border-gray-200/60 bg-white/50 backdrop-blur-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
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
            {/* Color swatches */}
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

            {/* Image + Gradient row */}
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

            {/* Text readability */}
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

        {/* Try These */}
        <div className="mt-8 text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Try saying</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              'I have red-green colorblindness',
              'Make it dark mode',
              'Too bright, hurts my eyes',
              'High contrast please',
              'I\'m light sensitive',
              'Reset to normal',
            ].map(phrase => (
              <span
                key={phrase}
                className="px-3 py-1.5 text-xs text-gray-500 bg-white rounded-full border border-gray-200 shadow-sm"
              >
                &ldquo;{phrase}&rdquo;
              </span>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
