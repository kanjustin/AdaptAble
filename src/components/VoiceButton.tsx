'use client';
import { useEffect, useState } from 'react';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { AccessibilityCommand } from '@/types';

interface Props {
  onCommand: (cmd: AccessibilityCommand) => void;
  onTranscript: (text: string) => void;
}

export function VoiceButton({ onCommand, onTranscript }: Props) {
  const { transcript, listening, startListening, supported } = useSpeechRecognition();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!transcript) return;
    onTranscript(transcript);
    setLoading(true);

    fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    })
      .then(r => r.json())
      .then(cmd => {
        onCommand(cmd);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
        onClick={startListening}
        disabled={listening || loading}
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
    </div>
  );
}
