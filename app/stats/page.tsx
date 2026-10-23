'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Layers, LineChart as LineIcon, PieChart, WalletCards } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useMoney } from '@/lib/format';
import { addMonths, currentMonth, daysInMonth, monthLabel } from '@/lib/dates';
import { byCard, byCategory, dailySpend, expensesOf, forCard, inMonth, monthlyBars, sum } from '@/lib/selectors';
import type { ChartType } from '@/lib/types';
import { CardCarousel, OverviewStack } from '@/components/stats/CardCarousel';
import { Dropdown } from '@/components/ui/Dropdown';
import { DonutChart } from '@/components/charts/DonutChart';
import { BarChart } from '@/components/charts/BarChart';
import { LineChart } from '@/components/charts/LineChart';
import { SpendBar } from '@/components/activity/SpendBar';
import { ChartFullscreen } from '@/components/charts/ChartFullscreen';
import { easeOut } from '@/lib/motion';

const CHARTS: { value: ChartType; label: string; icon: React.ReactNode }[] = [
  { value: 'pie', label: 'Pie Chart', icon: <PieChart size={14} /> },
  { value: 'bar', label: 'Bar Graph', icon: <BarChart3 size={14} /> },
  { value: 'line', label: 'Line Graph', icon: <LineIcon size={14} /> },
];
const ACCENT = 'rgb(var(--accent))';

export default function AnalyticsPage() {
  const money = useMoney();
  const { cards, transactions, categories, selectedCardId, selectCard, statsMode, setStatsMode, chartType, setChartType } = useStore();
  const [m, setM] = useState(currentMonth());

  // the carousel always has a card in focus
  useEffect(() => {
    if (cards.length && !cards.some((c) => c.id === selectedCardId)) selectCard(cards[0].id);
  }, [cards, selectedCardId, selectCard]);

  const index = Math.max(0, cards.findIndex((c) => c.id === selectedCardId));
  const card = cards[index];
  const overview = statsMode === 'overview' || !cards.length;
  const scope = overview ? transactions : forCard(transactions, card?.id ?? null);
  const isNow = m === currentMonth();
  const prevM = addMonths(m, -1);

  const stats = useMemo(() => {
    const month = inMonth(scope, m);
    const spent = sum(expensesOf(month)), last = sum(expensesOf(inMonth(scope, prevM)));
    const days = isNow ? new Date().getDate() : daysInMonth(m);
    return {
      spent, last, count: expensesOf(month).length, perDay: spent / days,
      delta: last ? (spent - last) / last : null,
      categories: byCategory(month, categories),
      slices: overview && cards.length ? byCard(month, cards) : byCategory(month, categories),
      bars: monthlyBars(scope, m, 6, overview && cards.length ? { cards } : undefined),
      daily: dailySpend(scope, m, isNow ? new Date().getDate() : undefined),
    };
  }, [scope, m, prevM, isNow, overview, cards, categories]);

  const chartTitle = chartType === 'pie' ? (overview && cards.length ? 'By payment mode' : 'By category') : chartType === 'bar' ? 'Last 6 months' : 'Daily spending';

  return (
    <div>
      {/* top bar */}
      <header className="flex items-center justify-between gap-2">
        <button aria-label={overview ? 'Show one card' : 'Show all payment modes'} disabled={!cards.length}
          onClick={() => setStatsMode(statsMode === 'overview' ? 'card' : 'overview')}
          className={`icon-btn ${overview && cards.length ? 'border-ink bg-ink text-onink' : ''} disabled:opacity-40`}>
          {overview ? <Layers size={17} /> : <WalletCards size={17} />}
        </button>
        <div className="flex items-center gap-1">
          <button aria-label="Previous month" onClick={() => setM((x) => addMonths(x, -1))} className="pressable grid size-8 place-items-center rounded-full text-label2"><ChevronLeft size={18} /></button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={m} className="text-[15px] font-semibold" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: easeOut }}>
              {monthLabel(m)}
            </motion.span>
          </AnimatePresence>
          <button aria-label="Next month" disabled={isNow} onClick={() => setM((x) => addMonths(x, 1))} className="pressable grid size-8 place-items-center rounded-full text-label2 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        <span className="size-10" aria-hidden />
      </header>

      <div className="lg:mt-4 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:items-start lg:gap-x-10">
      <div>
      {/* card(s) */}
      {cards.length > 0 && (
        <div className="relative -mx-4 mt-2 lg:mx-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={overview ? 'overview' : 'card'}
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ duration: 0.22, ease: easeOut }}>
              {overview
                ? <OverviewStack cards={cards} onDoubleTap={() => setStatsMode('card')} />
                : <CardCarousel cards={cards} index={index} onIndex={(i) => selectCard(cards[i].id)} onDoubleTap={() => setStatsMode('overview')} />}
            </motion.div>
          </AnimatePresence>
          <p className="-mt-1 text-center text-[11px] text-label3">
            {overview ? 'Double-tap to go back to one card' : 'Swipe to switch · double-tap for all payment modes'}
          </p>
        </div>
      )}

      </div>
      <div className="lg:pt-6">
      {/* headline */}
      <div className="mt-5 flex items-end justify-between lg:mt-0">
        <div>
          <p className="text-[12px] text-label2">{overview ? 'All payment modes' : card?.name} · spent</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={`${overview}-${card?.id}-${m}`} className="tabular text-[30px] font-bold leading-tight tracking-[-0.025em]"
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: easeOut }}>
              {money(stats.spent)}
            </motion.p>
          </AnimatePresence>
        </div>
        {stats.delta !== null && (
          <span className={`tabular mb-1.5 rounded-[8px] px-2 py-1 text-[12px] font-semibold ${stats.delta > 0 ? 'bg-bad/10 text-bad' : 'bg-ok/10 text-ok'}`}>
            {stats.delta > 0 ? '↗' : '↘'} {Math.abs(stats.delta * 100).toFixed(1)}% vs {monthLabel(prevM, 'short')}
          </span>
        )}
      </div>

      <div className="mt-4"><SpendBar title="Total Spend" total={stats.spent} slices={stats.categories} /></div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {[
          ['Transactions', String(stats.count)],
          ['Daily avg', money(stats.perDay)],
          ['Last month', money(stats.last)],
        ].map(([label, value]) => (
          <div key={label} className="panel min-w-0 px-2.5 py-2.5">
            <div className="text-[11px] text-label2">{label}</div>
            <div className="tabular mt-0.5 truncate text-[12.5px] font-semibold tracking-[-0.01em]">{value}</div>
          </div>
        ))}
      </div>

      </div>

      {/* chart */}
      <section className="panel mt-4 px-4 pb-4 pt-3.5 lg:col-span-2 lg:mt-8 lg:px-6 lg:pb-6 lg:pt-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">{chartTitle}</h2>
          <div className="flex items-center gap-2">
            <Dropdown value={chartType} onChange={setChartType} options={CHARTS} label="Chart type" />
            <ChartFullscreen title={chartTitle} subtitle={`${overview ? 'All payment modes' : card?.name ?? ''} · ${chartType === 'bar' ? 'last 6 months' : monthLabel(m)}`}>
              {({ width, height }) => (
                <>
                  {chartType === 'pie' && (stats.slices.length
                    ? <div className="grid h-full place-items-center"><DonutChart data={stats.slices} wide={width > height * 1.2} size={Math.min(height - 16, width > height * 1.2 ? width * 0.45 : width - 16, 460)} /></div>
                    : <p className="py-16 text-center text-[13px] text-label2">No spending in {monthLabel(m)}.</p>)}
                  {chartType === 'bar' && <BarChart data={stats.bars} accent={ACCENT} height={height} />}
                  {chartType === 'line' && <LineChart data={stats.daily} accent={ACCENT} height={height} />}
                </>
              )}
            </ChartFullscreen>
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={`${chartType}-${overview}-${card?.id}-${m}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: easeOut }}>
            {chartType === 'pie' && (stats.slices.length
              ? <DonutChart data={stats.slices} />
              : <p className="py-16 text-center text-[13px] text-label2">No spending in {monthLabel(m)}.</p>)}
            {chartType === 'bar' && <BarChart data={stats.bars} accent={ACCENT} />}
            {chartType === 'line' && <LineChart data={stats.daily} accent={ACCENT} />}
          </motion.div>
        </AnimatePresence>
      </section>
      </div>
    </div>
  );
}
