'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, RotateCw, X } from 'lucide-react';
import { useMeasure } from '@/lib/useMeasure';
import { easeOut } from '@/lib/motion';

type Size = { width: number; height: number };

/**
 * "Expand" button + full-screen viewer for any chart.
 * Uses the browser Fullscreen API and tries to lock landscape (Android / desktop).
 * Where locking isn't allowed (iPhone), a Rotate button turns the view 90° so the
 * chart still gets the long edge of the screen.
 */
export function ChartFullscreen({ title, subtitle, children }: {
  title: string; subtitle?: string;
  /** Rendered with the space available inside the viewer. */
  children: (size: Size) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={`Open ${title} full screen`} title="Full screen"
        className="pressable grid size-8 shrink-0 place-items-center rounded-full bg-soft text-label2 hover:text-label">
        <Maximize2 size={14} strokeWidth={2.2} />
      </button>
      {mounted && createPortal(
        <AnimatePresence>{open && <Viewer title={title} subtitle={subtitle} onClose={() => setOpen(false)}>{children}</Viewer>}</AnimatePresence>,
        document.body,
      )}
    </>
  );
}

function Viewer({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: (s: Size) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [rotated, setRotated] = useState(false);
  const [portrait, setPortrait] = useState(false);
  const [body, size] = useMeasure<HTMLDivElement>();

  // enter real fullscreen + try a landscape lock; undo both on close
  useEffect(() => {
    const el = root.current;
    el?.requestFullscreen?.().then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return o?.lock?.('landscape');
    }).catch(() => { /* not allowed here: the Rotate button covers it */ });
    const onFs = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener('fullscreenchange', onFs);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      document.body.style.overflow = prev;
      try { (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.(); } catch { /* ignore */ }
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  useEffect(() => {
    const mq = window.matchMedia('(orientation: portrait) and (max-width: 820px)');
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener('change', on);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => { mq.removeEventListener('change', on); window.removeEventListener('keydown', esc); };
  }, [onClose]);

  // once the device is physically turned, drop the CSS rotation
  useEffect(() => { if (!portrait) setRotated(false); }, [portrait]);
  const turn = useCallback(() => setRotated((r) => !r), []);
  const spin = rotated && portrait;

  return (
    <motion.div ref={root} role="dialog" aria-modal="true" aria-label={`${title}, full screen`}
      className="fixed inset-0 z-[80] overflow-hidden bg-canvas"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }} transition={{ duration: 0.2, ease: easeOut }}>
      <div
        className="absolute left-1/2 top-1/2 flex flex-col"
        style={spin
          ? { width: '100vh', height: '100vw', transform: 'translate(-50%, -50%) rotate(90deg)' }
          : { width: '100vw', height: '100dvh', transform: 'translate(-50%, -50%)' }}
      >
        <header className="flex shrink-0 items-center gap-3 px-5 pb-2 pt-[max(14px,env(safe-area-inset-top))]">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-semibold">{title}</h2>
            {subtitle && <p className="truncate text-[12px] text-label2">{subtitle}</p>}
          </div>
          {portrait && (
            <button onClick={turn} className="pressable flex h-9 items-center gap-1.5 rounded-full bg-soft px-3.5 text-[12.5px] font-semibold">
              <RotateCw size={14} /> {spin ? 'Upright' : 'Rotate'}
            </button>
          )}
          <button onClick={onClose} aria-label="Close full screen" className="pressable grid size-9 place-items-center rounded-full bg-ink text-onink">
            <X size={17} strokeWidth={2.4} />
          </button>
        </header>
        <div ref={body} className="relative min-h-0 flex-1 overflow-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
          {size.width > 0 && children({ width: size.width, height: Math.max(200, size.height - 8) })}
        </div>
      </div>
    </motion.div>
  );
}
