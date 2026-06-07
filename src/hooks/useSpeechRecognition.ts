'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseSpeechRecognitionReturn {
  transcript: string;
  listening: boolean;
  startListening: () => void;
  supported: boolean;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState('');
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSupported(
      'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
    );
  }, []);

  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SR =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;

    if (recognitionRef.current) recognitionRef.current.abort();

    const recognition = new SR() as SpeechRecognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[0][0].transcript;
      setTranscript(text);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  return { transcript, listening, startListening, supported };
}
