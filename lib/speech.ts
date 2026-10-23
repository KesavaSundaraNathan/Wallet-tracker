'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/* Minimal typings for the Web Speech API (not in TS's DOM lib everywhere). */
type SRResult = { isFinal: boolean; 0: { transcript: string } };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
interface SR {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SREvent) => void) | null; onend: (() => void) | null; onerror: ((e: { error: string }) => void) | null;
}
type SRCtor = new () => SR;

const ctor = (): SRCtor | null =>
  typeof window === 'undefined' ? null : ((window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor }).SpeechRecognition
    ?? (window as unknown as { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition ?? null);

export const speechSupported = () => !!ctor();

/** English speech-to-text using the browser's built-in recogniser (free, no key). */
export function useSpeech(onDone: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SR | null>(null);
  const finalText = useRef('');
  const done = useRef(onDone);
  done.current = onDone;

  const start = useCallback(() => {
    const C = ctor();
    if (!C) { setError('Voice input isn’t supported in this browser. Type instead, or use Chrome, Edge or Safari.'); return; }
    rec.current?.abort();
    const r = new C();
    const nav = navigator.language || 'en-US';
    r.lang = nav.toLowerCase().startsWith('en') ? nav : 'en-US';
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    finalText.current = '';
    setInterim('');
    setError(null);
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += `${res[0].transcript} `;
        else live += res[0].transcript;
      }
      setInterim((finalText.current + live).trim());
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') setError('Microphone access was blocked. Allow it in the browser’s site settings.');
      else if (e.error === 'no-speech') setError('I didn’t hear anything. Hold and try again.');
      else if (e.error !== 'aborted') setError(`Voice input stopped (${e.error}).`);
    };
    r.onend = () => {
      setListening(false);
      const text = (finalText.current || '').trim() || interimRef.current.trim();
      rec.current = null;
      if (text) done.current(text);
    };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setError('Couldn’t start the microphone.'); }
  }, []);

  // keep the latest interim text for onend (some browsers never mark results final on stop)
  const interimRef = useRef('');
  useEffect(() => { interimRef.current = interim; }, [interim]);

  const stop = useCallback(() => { rec.current?.stop(); }, []);
  const cancel = useCallback(() => { if (rec.current) { rec.current.onend = null; rec.current.abort(); rec.current = null; } setListening(false); }, []);
  useEffect(() => () => { rec.current?.abort(); }, []);

  return { listening, interim, error, start, stop, cancel, setError };
}

/** Read a short sentence aloud with an English system voice. */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  const voices = synth.getVoices();
  u.voice = voices.find((v) => /en[-_](US|GB|AU|IN)/i.test(v.lang) && /natural|google|samantha|enhanced/i.test(v.name))
    ?? voices.find((v) => v.lang?.toLowerCase().startsWith('en')) ?? null;
  u.lang = u.voice?.lang ?? 'en-US';
  u.rate = 1.03;
  synth.speak(u);
}
export const stopSpeaking = () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); };
