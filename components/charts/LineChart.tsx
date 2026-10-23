'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useMoney } from '@/lib/format';
import { useMeasure } from '@/lib/useMeasure';
import { easeOut, springSnappy } from '@/lib/motion';

const H0 = 250, PAD_T = 56, PAD_B = 34, STEP = 34, SIDE = 22;
type Point = { date: string; value: number | null; count: number };

/** Smooth monotone curve (never dips below the data). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[Math.max(0, i - 1)], [x1, y1] = pts[i], [x2, y2] = pts[i + 1], [x3, y3] = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6, c1y = Math.min(Math.max(y1 + (y2 - y0) / 6, Math.min(y1, y2)), Math.max(y1, y2));
    const c2x = x2 - (x3 - x1) / 6, c2y = Math.min(Math.max(y2 - (y3 - y1) / 6, Math.min(y1, y2)), Math.max(y1, y2));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  }
  return d;
}

const ddmm = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/**
 * Daily spending. Every day is a point labelled dd-mm; the plot scrolls
 * sideways when the month doesn't fit. Hover / drag scrubs: a guide line,
 * the point grows and a tooltip follows.
 */
export function LineChart({ data, accent, height = H0 }: { data: Point[]; accent: string; height?: number }) {
  const H = height;
  const money = useMoney();
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const scroller = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const n = data.length;
  const W = Math.max(width || 320, SIDE * 2 + (n - 1) * STEP);
  const max = Math.max(1, ...data.map((d) => d.value ?? 0)) * 1.15;
  const x = (i: number) => (n <= 1 ? W / 2 : SIDE + (i / (n - 1)) * (W - SIDE * 2));
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);
  const live = data.map((d, i) => ({ ...d, i })).filter((d) => d.value !== null) as (Point & { i: number; value: number })[];
  const pts = live.map((d) => [x(d.i), y(d.value)] as [number, number]);
  const path = smooth(pts);
  const area = pts.length > 1 ? `${path} L${pts[pts.length - 1][0]},${y(0)} L${pts[0][0]},${y(0)} Z` : '';
  const lastLive = live.length ? live[live.length - 1].i : 0;

  // open scrolled to the latest day
  useEffect(() => {
    const el = scroller.current;
    if (el && width) el.scrollLeft = Math.max(0, x(lastLive) - el.clientWidth + SIDE * 3);
  }, [width, lastLive]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left - SIDE) / (W - SIDE * 2)) * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, i));
    setHover(data[clamped]?.value === null ? lastLive : clamped);
  };
  const h = hover !== null ? data[hover] : null;
  const ticks = [0.33, 0.66, 1].map((f) => (max / 1.15) * f);

  return (
    <div ref={ref} className="relative w-full">
      <div ref={scroller} className="no-scrollbar relative overflow-x-auto overscroll-x-contain">
        <svg width={W} height={H} className="block touch-pan-x select-none" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          <defs>
            <linearGradient id="daily-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={accent} stopOpacity="0.22" />
              <stop offset="1" stopColor={accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {ticks.map((t) => <line key={t} x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--line))" strokeDasharray="3 5" />)}
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgb(var(--line))" />

          {/* hover guide */}
          {h && h.value !== null && (
            <line x1={x(hover!)} x2={x(hover!)} y1={PAD_T - 8} y2={y(0)} stroke={accent} strokeOpacity={0.35} strokeDasharray="4 4" />
          )}

          <motion.path d={area} fill="url(#daily-area)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }} />
          <motion.path d={path} fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: easeOut }} />

          {/* a point and a dd-mm label for every day */}
          {data.map((d, i) => {
            const active = hover === i;
            const future = d.value === null;
            return (
              <g key={d.date}>
                {!future && (
                  <motion.circle cx={x(i)} cy={y(d.value!)} fill={active ? accent : 'rgb(var(--elevated))'} stroke={accent} strokeOpacity={d.value ? 1 : 0.45}
                    initial={{ r: 0 }} animate={{ r: active ? 6.5 : d.value ? 4 : 3, strokeWidth: active ? 3 : 2 }}
                    transition={{ ...springSnappy, delay: hover === null ? 0.25 + i * 0.012 : 0 }} />
                )}
                <text x={x(i)} y={H - 12} textAnchor="middle"
                  className={`tabular text-[10px] transition-colors ${active ? 'fill-[currentColor] font-semibold' : future ? 'fill-label3/50' : 'fill-label3'}`}
                  style={active ? { color: accent } : undefined}>
                  {ddmm(d.date)}
                </text>
              </g>
            );
          })}
        </svg>

        {/* tooltip rides above the hovered point */}
        <AnimatePresence>
          {h && h.value !== null && (
            <motion.div key="tip" className="pointer-events-none absolute top-1 w-[124px] rounded-[12px] border border-line bg-elevated px-3 py-2 shadow-[0_10px_24px_-12px_rgb(0_0_0/0.3)]"
              initial={{ opacity: 0, y: 4, left: Math.min(W - 128, Math.max(4, x(hover!) - 62)) }} animate={{ opacity: 1, y: 0, left: Math.min(W - 128, Math.max(4, x(hover!) - 62)) }} exit={{ opacity: 0, transition: { duration: 0.1 } }}
              transition={{ ...springSnappy, opacity: { duration: 0.12 } }}>
              <div className="tabular text-[11px] font-medium text-label2">{ddmm(h.date)}</div>
              <div className="tabular text-[14px] font-bold">{money(h.value)}</div>
              <div className="text-[10.5px] text-label3">{h.count} {h.count === 1 ? 'transaction' : 'transactions'}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* fixed y scale */}
      <div className="pointer-events-none absolute right-0 top-0" style={{ height: H }}>
        {ticks.map((t) => (
          <span key={t} className="tabular absolute right-0 -translate-y-full rounded bg-elevated/85 px-1 text-[9.5px] text-label3" style={{ top: y(t) - 2 }}>
            {money(t, { compact: true })}
          </span>
        ))}
      </div>
    </div>
  );
}
