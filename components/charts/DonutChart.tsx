'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import type { Slice } from '@/lib/selectors';
import { useMoney } from '@/lib/format';
import { easeOut } from '@/lib/motion';

const SIZE = 280, C = SIZE / 2, R = 104, SW = 26;
const TAU = Math.PI * 2;

const polar = (a: number, r = R) => [C + r * Math.cos(a - Math.PI / 2), C + r * Math.sin(a - Math.PI / 2)];
function arc(a0: number, a1: number, r = R) {
  const [x0, y0] = polar(a0, r), [x1, y1] = polar(a1, r);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
}

/**
 * Not-a-generic pie: a thick ring of rounded, gapped segments with per-slice
 * gradients and a soft glow, a watch-face tick ring, and a live centre readout.
 * Segments sweep in on mount; hovering one thickens it and dims the rest.
 */
export function DonutChart({ data, centerLabel = 'Spent', size = SIZE, wide = false }: { data: Slice[]; centerLabel?: string; size?: number; wide?: boolean }) {
  const money = useMoney();
  const [active, setActive] = useState<string | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const capAngle = (SW / 2) / R;
  const gap = data.length > 1 ? capAngle * 2 + 0.035 : 0;

  let acc = 0;
  const segs = data.map((d) => {
    const sweep = total ? (d.value / total) * TAU : 0;
    const a0 = acc + gap / 2, a1 = acc + sweep - gap / 2;
    acc += sweep;
    return { ...d, a0, a1: Math.max(a1, a0 + 0.0001), share: total ? d.value / total : 0 };
  });
  const focus = segs.find((s) => s.id === active);

  return (
    <div className={`flex items-center ${wide ? 'flex-row justify-center gap-12' : 'flex-col gap-6'}`}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={size} height={size} className="overflow-visible">
          <defs>
            {segs.map((s) => (
              <linearGradient key={s.id} id={`dg-${s.id}`} gradientUnits="userSpaceOnUse" x1={polar(s.a0)[0]} y1={polar(s.a0)[1]} x2={polar(s.a1)[0]} y2={polar(s.a1)[1]}>
                <stop offset="0" stopColor={s.color} stopOpacity="0.75" />
                <stop offset="1" stopColor={s.color} />
              </linearGradient>
            ))}
            <filter id="dglow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="10" /></filter>
          </defs>

          {/* tick ring */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * TAU;
            const [x0, y0] = polar(a, R - SW / 2 - 12), [x1, y1] = polar(a, R - SW / 2 - (i % 5 === 0 ? 20 : 16));
            return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="rgb(var(--label) / 0.12)" strokeWidth={i % 5 === 0 ? 1.4 : 0.8} strokeLinecap="round" />;
          })}
          {/* track */}
          <circle cx={C} cy={C} r={R} fill="none" stroke="rgb(var(--fill) / 0.12)" strokeWidth={SW} />

          {/* glow layer */}
          <g filter="url(#dglow)" opacity="0.45">
            {segs.map((s, i) => (
              <motion.path key={s.id} d={s.share >= 0.999 ? arc(0, TAU - 0.0001) : arc(s.a0, s.a1)} fill="none" stroke={s.color} strokeWidth={SW} strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1, opacity: active && active !== s.id ? 0.2 : 1 }}
                transition={{ pathLength: { duration: 0.7, ease: easeOut, delay: 0.1 + i * 0.06 }, opacity: { duration: 0.2 } }} />
            ))}
          </g>
          {/* segments */}
          {segs.map((s, i) => (
            <motion.path
              key={s.id}
              d={s.share >= 0.999 ? arc(0, TAU - 0.0001) : arc(s.a0, s.a1)}
              fill="none" stroke={`url(#dg-${s.id})`} strokeLinecap="round"
              initial={{ pathLength: 0, strokeWidth: SW }}
              animate={{ pathLength: 1, strokeWidth: active === s.id ? SW + 8 : SW, opacity: active && active !== s.id ? 0.35 : 1 }}
              transition={{ pathLength: { duration: 0.7, ease: easeOut, delay: 0.1 + i * 0.06 }, strokeWidth: { type: 'spring', bounce: 0.3, duration: 0.35 }, opacity: { duration: 0.2 } }}
              onPointerEnter={() => setActive(s.id)}
              onPointerLeave={() => setActive(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div key={focus?.id ?? 'total'} initial={{ opacity: 0, y: 4, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -4, filter: 'blur(3px)' }} transition={{ duration: 0.16, ease: easeOut }}>
              <div className="text-footnote text-label2">{focus ? `${focus.emoji ? focus.emoji + ' ' : ''}${focus.label}` : centerLabel}</div>
              <div className="tabular text-title2">{money(focus ? focus.value : total)}</div>
              {focus && <div className="tabular text-footnote text-label2">{Math.round(focus.share * 100)}%</div>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* legend with proportional meters */}
      <ul className="w-full max-w-[420px] flex-1 space-y-1">
        {segs.map((s, i) => (
          <motion.li
            key={s.id}
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: active && active !== s.id ? 0.45 : 1, x: 0 }}
            transition={{ duration: 0.3, ease: easeOut, delay: 0.15 + i * 0.04 }}
            onPointerEnter={() => setActive(s.id)} onPointerLeave={() => setActive(null)}
            className="flex cursor-default items-center gap-3 rounded-[10px] px-2 py-1.5 hover:bg-fill/[0.06]"
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
            <span className="w-32 truncate text-callout">{s.label}</span>
            <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-fill/[0.12]">
              <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: s.color }}
                initial={{ width: 0 }} animate={{ width: `${(s.value / (segs[0]?.value || 1)) * 100}%` }} transition={{ duration: 0.6, ease: easeOut, delay: 0.2 + i * 0.04 }} />
            </span>
            <span className="tabular w-10 text-right text-footnote text-label2">{Math.round(s.share * 100)}%</span>
            <span className="tabular w-24 text-right text-callout font-medium">{money(s.value)}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
