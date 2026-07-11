'use client';
import { useEffect, useRef, useState } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { AccessibilityCommand, FilterState } from '@/types';

interface Props {
  onCommand: (cmd: AccessibilityCommand) => void;
  onTranscript: (text: string) => void;
  currentState: FilterState;
}

export function VoiceButton({ onCommand, onTranscript, currentState }: Props) {
  const { transcript, listening, startListening, stopListening, supported } = useSpeechRecognition();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentStateRef = useRef(currentState);
  useEffect(() => { currentStateRef.current = currentState; }, [currentState]);

  useEffect(() => {
    if (!transcript) return;
    const controller = new AbortController();
    const run = async () => {
      onTranscript(transcript);
      setError('');
      setLoading(true);
      try {
        const res = await fetch('/api/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript, currentState: currentStateRef.current }),
          signal: controller.signal,
        });
        const cmd = await res.json();
        if (!res.ok || cmd.error) setError(cmd.error || `Error ${res.status}`);
        else if (cmd.needsClarification) setError(cmd.explanation || 'Please rephrase your request.');
        else onCommand(cmd);
      } catch (err: unknown) {
        if ((err as Error)?.name !== 'AbortError') setError('Connection error — try again');
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [transcript]);

  if (!supported) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Voice requires Chrome or Edge
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        onClick={listening ? stopListening : startListening}
        disabled={loading}
        className="relative group"
      >
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ripple" />
            <span className="absolute inset-0 rounded-full bg-red-400 animate-ripple [animation-delay:0.5s]" />
          </>
        )}
        <span
          className={`relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300 shadow-lg ${
            listening
              ? 'bg-red-500 animate-mic-glow scale-110'
              : loading
              ? 'bg-amber-500'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-400 hover:to-indigo-500 hover:scale-105 hover:shadow-xl active:scale-95'
          }`}
        >
          {loading ? (
            <svg className="w-8 h-8 text-white animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          )}
        </span>
      </button>
      <span className={`text-xs font-medium tracking-wide uppercase transition-colors ${
        listening ? 'text-red-500' : loading ? 'text-amber-600' : 'text-gray-400'
      }`}>
        {listening ? 'Listening...' : loading ? 'Processing...' : 'Tap to speak'}
      </span>
      {error && (
        <span className="text-xs text-red-500 animate-fade-in-up">{error}</span>
      )}
    </div>
  );
}
