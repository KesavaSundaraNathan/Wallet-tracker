'use client';

import { motion } from 'framer-motion';
import type { Slice } from '@/lib/selectors';
import { topGroups } from '@/lib/selectors';
import { useMoney } from '@/lib/format';
import { easeOut } from '@/lib/motion';
import { ChartFullscreen } from '@/components/charts/ChartFullscreen';

/** "Total Spend" card: a segmented bar with a dotted legend underneath. */
export function SpendBar({ title, total, slices }: { title: string; total: number; slices: Slice[] }) {
  const money = useMoney();
  const groups = topGroups(slices.filter((s) => s.value > 0));
  return (
    <div className="soft-card px-4 pb-4 pt-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-label">{title}</span>
        <span className="flex items-center gap-2">
          <span className="tabular text-[14px] font-bold">{money(total)}</span>
          {groups.length > 0 && (
            <ChartFullscreen title={title} subtitle={money(total)}>
              {({ height }) => <SpendBreakdown slices={slices.filter((s) => s.value > 0)} total={total} height={height} />}
            </ChartFullscreen>
          )}
        </span>
      </div>
      <div className="mt-3 flex h-7 gap-1">
        {groups.length === 0 && <div className="flex-1 rounded-[7px] bg-line" />}
        {groups.map((g, i) => (
          <motion.div key={g.id} title={`${g.label} · ${money(g.value)}`}
            className="min-w-[10px] rounded-[7px]" style={{ background: g.color, flexGrow: g.value, flexBasis: 0, transformOrigin: 'left' }}
            initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ duration: 0.5, ease: easeOut, delay: i * 0.05 }} />
        ))}
      </div>
      {groups.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
          {groups.map((g) => (
            <span key={g.id} className="flex items-center gap-1.5 text-[11.5px] text-label2">
              <span className="size-[7px] rounded-full" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Full-screen version: every group as a long horizontal bar with share and amount. */
function SpendBreakdown({ slices, total, height }: { slices: Slice[]; total: number; height: number }) {
  const money = useMoney();
  const max = slices[0]?.value || 1;
  const row = Math.max(34, Math.min(56, (height - 70) / Math.max(1, slices.length)));
  return (
    <div className="mx-auto w-full max-w-[1100px]">
      <div className="flex h-10 gap-1.5">
        {slices.map((g, i) => (
          <motion.div key={g.id} className="min-w-[8px] rounded-[9px]" style={{ background: g.color, flexGrow: g.value, flexBasis: 0, transformOrigin: 'left' }}
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.5, ease: easeOut, delay: i * 0.04 }} />
        ))}
      </div>
      <ul className="mt-5">
        {slices.map((g, i) => (
          <motion.li key={g.id} style={{ height: row }} className="flex items-center gap-3"
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: easeOut, delay: 0.1 + i * 0.03 }}>
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: g.color }} />
            <span className="w-[34%] truncate text-[14px] font-medium">{g.emoji && g.emoji !== '•' ? `${g.emoji} ` : ''}{g.label}</span>
            <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-soft">
              <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: g.color }}
                initial={{ width: 0 }} animate={{ width: `${(g.value / max) * 100}%` }} transition={{ duration: 0.6, ease: easeOut, delay: 0.15 + i * 0.03 }} />
            </span>
            <span className="tabular w-12 text-right text-[12.5px] text-label2">{total ? Math.round((g.value / total) * 100) : 0}%</span>
            <span className="tabular w-28 text-right text-[14px] font-semibold">{money(g.value)}</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
