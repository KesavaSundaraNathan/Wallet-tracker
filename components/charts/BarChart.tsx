'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { MonthBar } from '@/lib/selectors';
import { useMoney } from '@/lib/format';
import { useMeasure } from '@/lib/useMeasure';
import { easeOut } from '@/lib/motion';

const H0 = 260, PAD_T = 28, PAD_B = 28;

/** Monthly bars; stacked by payment mode in overview. Current month carries the accent. */
export function BarChart({ data, accent, height = H0 }: { data: MonthBar[]; accent: string; height?: number }) {
  const H = height;
  const money = useMoney();
  const [ref, { width }] = useMeasure<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const W = Math.max(width, 280);
  const max = Math.max(1, ...data.map((d) => d.total)) * 1.1;
  const slot = W / data.length;
  const bw = Math.min(56, slot * 0.56);
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <div ref={ref} className="relative w-full">
      <svg width={W} height={H} className="overflow-visible">
        <defs>
          <linearGradient id="bar-accent" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={accent} />
            <stop offset="1" stopColor={accent} stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="rgb(var(--sep) / 0.14)" strokeDasharray={i ? '3 4' : undefined} />
            {i > 0 && <text x={W} y={y(t) - 5} textAnchor="end" className="fill-label3 text-[10px] tabular">{money(t, { compact: true })}</text>}
          </g>
        ))}
        {data.map((d, i) => {
          const x = i * slot + (slot - bw) / 2;
          const isLast = i === data.length - 1;
          let acc = 0;
          const segs = d.segments.filter((s) => s.value > 0);
          return (
            <g key={d.key} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} style={{ cursor: 'default' }}>
              <rect x={i * slot} y={PAD_T} width={slot} height={H - PAD_T - PAD_B} fill="transparent" />
              <motion.g
                style={{ transformBox: 'fill-box', transformOrigin: 'bottom' } as React.CSSProperties}
                initial={{ scaleY: 0 }} animate={{ scaleY: 1, opacity: hover !== null && hover !== i ? 0.45 : 1 }}
                transition={{ scaleY: { duration: 0.6, ease: easeOut, delay: i * 0.05 }, opacity: { duration: 0.15 } }}
              >
                {segs.length === 0 && <rect x={x} y={y(0) - 2} width={bw} height={2} rx={1} fill="rgb(var(--fill) / 0.2)" />}
                {segs.map((s, k) => {
                  const top = y(acc + s.value), bottom = y(acc);
                  acc += s.value;
                  const isTop = k === segs.length - 1;
                  const fill = s.color || (isLast ? 'url(#bar-accent)' : 'rgb(var(--accent) / 0.18)');
                  return (
                    <path key={s.id} fill={fill}
                      d={roundedTop(x, top, bw, Math.max(0, bottom - top - (isTop ? 0 : 1.5)), isTop ? Math.min(8, bw / 3) : 0)} />
                  );
                })}
              </motion.g>
              <text x={i * slot + slot / 2} y={H - 8} textAnchor="middle" className={`text-[11px] ${isLast ? 'fill-label font-semibold' : 'fill-label2'}`}>{d.label}</text>
              {(hover === i || (hover === null && isLast)) && d.total > 0 && (
                <motion.text initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
                  x={i * slot + slot / 2} y={y(d.total) - 8} textAnchor="middle" className="fill-label text-[11px] font-semibold tabular">
                  {money(d.total, { compact: d.total >= 10000 })}
                </motion.text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover].segments.length > 1 && (
        <div className="glass glass-hairline pointer-events-none absolute top-0 rounded-[12px] px-3 py-2 text-caption shadow-float"
          style={{ left: Math.min(W - 180, Math.max(0, hover * slot + slot / 2 - 90)), width: 180 }}>
          {data[hover].segments.filter((s) => s.value > 0).map((s) => (
            <div key={s.id} className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: s.color }} /><span className="flex-1 truncate">{s.label}</span><span className="tabular">{money(s.value)}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}
