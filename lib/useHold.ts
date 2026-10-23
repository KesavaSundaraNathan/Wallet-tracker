'use client';

import { useRef, useState } from 'react';
import { useVoice } from './voice';

const HOLD_MS = 380;

/**
 * Tap → `onTap` (unchanged + behaviour). Press and hold → voice mode, listening
 * until the finger lifts. Works with touch, mouse and pen; keyboard Enter = tap.
 */
export function useHoldToTalk(onTap: () => void) {
  const startHold = useVoice((s) => s.startHold);
  const release = useVoice((s) => s.release);
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const clear = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = null; setPressing(false); };

  return {
    pressing,
    handlers: {
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        fired.current = false;
        setPressing(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
        timer.current = window.setTimeout(() => {
          fired.current = true;
          setPressing(false);
          try { navigator.vibrate?.(12); } catch { /* ignore */ }
          startHold();
        }, HOLD_MS);
      },
      onPointerUp: () => {
        const wasHold = fired.current;
        clear();
        if (wasHold) release(); else onTap();
        fired.current = false;
      },
      onPointerCancel: () => { const wasHold = fired.current; clear(); if (wasHold) release(); fired.current = false; },
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
      onClick: (e: React.MouseEvent) => { if (e.detail === 0) onTap(); }, // keyboard activation
      style: { touchAction: 'none', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties,
    },
  };
}
