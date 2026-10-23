'use client';

import { animate, motion, useMotionValue, type PanInfo } from 'framer-motion';
import { useEffect, useRef } from 'react';
import type { Card } from '@/lib/types';
import { useMeasure } from '@/lib/useMeasure';
import { project, spring, springPop } from '@/lib/motion';
import { WalletCard } from '@/components/card/WalletCard';

const GAP = 28;

/**
 * One card at a time. Drag tracks 1:1 (respecting where you grabbed), release
 * projects momentum to pick the destination, and the spring inherits the finger's
 * velocity so there's no seam between drag and animation. Edges rubber-band.
 * Swipe left → next, swipe right → previous. Double-tap → onDoubleTap.
 */
export function CardCarousel({ cards, index, onIndex, onDoubleTap }: { cards: Card[]; index: number; onIndex: (i: number) => void; onDoubleTap: () => void }) {
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const W = Math.min((width || 380) - 36, 360);
  const step = W + GAP;
  const x = useMotionValue(0);
  const releaseVelocity = useRef(0);
  const lastTap = useRef(0);
  const ready = useRef(false);

  useEffect(() => {
    const target = -index * step;
    if (!ready.current || !width) { x.set(target); if (width) ready.current = true; return; }
    const v = releaseVelocity.current;
    releaseVelocity.current = 0;
    const c = animate(x, target, { type: 'spring', bounce: Math.abs(v) > 300 ? 0.2 : 0, duration: 0.45, velocity: v });
    return c.stop;
  }, [index, step, width, x]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const projected = x.get() + project(info.velocity.x, 0.99);
    const raw = Math.round(-projected / step);
    const next = Math.max(0, Math.min(cards.length - 1, Math.max(index - 1, Math.min(index + 1, raw))));
    releaseVelocity.current = info.velocity.x;
    if (next !== index) onIndex(next);
    else animate(x, -index * step, { type: 'spring', bounce: 0, duration: 0.4, velocity: info.velocity.x });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]')) return;
      if (e.key === 'ArrowRight') onIndex(Math.min(cards.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndex(Math.max(0, index - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, cards.length, onIndex]);

  return (
    <div ref={ref} className="relative w-full overflow-x-clip py-4">
      <motion.div
        className="flex cursor-grab touch-pan-y active:cursor-grabbing"
        style={{ x, gap: GAP, paddingLeft: Math.max(0, ((width || W) - W) / 2) }}
        drag="x"
        dragConstraints={{ left: -(cards.length - 1) * step, right: 0 }}
        dragElastic={0.18}
        dragMomentum={false}
        onDragEnd={onDragEnd}
        onTap={() => {
          const now = performance.now();
          if (now - lastTap.current < 320) { lastTap.current = 0; onDoubleTap(); }
          else lastTap.current = now;
        }}
      >
        {cards.map((c, i) => (
          <motion.div
            key={c.id}
            className="shrink-0 rounded-card shadow-card"
            style={{ width: W }}
            animate={{ scale: i === index ? 1 : 0.9, opacity: i === index ? 1 : 0.4 }}
            transition={spring}
            onClick={() => i !== index && onIndex(i)}
          >
            <WalletCard card={c} interactive={i === index} />
          </motion.div>
        ))}
      </motion.div>
      <div className="mt-5 flex justify-center gap-1.5">
        {cards.map((c, i) => (
          <button key={c.id} aria-label={`Show ${c.name}`} onClick={() => onIndex(i)} className="p-1">
            <motion.span className="block h-1.5 rounded-full bg-label" animate={{ width: i === index ? 18 : 6, opacity: i === index ? 0.9 : 0.25 }} transition={spring} />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Overview: all cards fanned like the wallet. Double-tap to return to single-card view. */
export function OverviewStack({ cards, onDoubleTap }: { cards: Card[]; onDoubleTap: () => void }) {
  const lastTap = useRef(0);
  const W = 280, PEEK = 26, H = W / 1.586;
  return (
    <div className="flex justify-center py-4">
      <motion.div
        className="relative cursor-pointer"
        style={{ width: W, height: H + (cards.length - 1) * PEEK }}
        onTap={() => {
          const now = performance.now();
          if (now - lastTap.current < 320) { lastTap.current = 0; onDoubleTap(); } else lastTap.current = now;
        }}
      >
        {cards.map((c, i) => (
          <motion.div key={c.id} className="absolute inset-x-0 top-0 rounded-card shadow-card"
            initial={{ y: 0, opacity: 0 }} animate={{ y: i * PEEK, opacity: 1 }} transition={{ ...springPop, delay: i * 0.03 }} style={{ zIndex: i }}>
            <WalletCard card={c} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
