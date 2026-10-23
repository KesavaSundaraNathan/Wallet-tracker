'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Repeat, Search, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSheet } from '@/lib/sheet';
import { useMoney } from '@/lib/format';
import { addMonths, monthKey, monthLabel, parseISODate } from '@/lib/dates';
import { byCategory, byMerchant, expensesOf, groupByDay, incomeOf, inMonth, inRange, sum, transfersOf } from '@/lib/selectors';
import { TransactionRow, DayHeader } from '@/components/activity/TransactionRow';
import { SpendBar } from '@/components/activity/SpendBar';
import { easeOut } from '@/lib/motion';

type Tab = 'all' | 'income' | 'expense' | 'transfer';
const TABS: { value: Tab; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];

export default function TransactionsPage() {
  const money = useMoney();
  const { transactions, categories, cards, activeMonth, selectedCardId, activityFollowsCard, setActivityFollowsCard } = useStore();
  const openSheet = useSheet((s) => s.open);

  const [month, setMonth] = useState(activeMonth);
  const [tab, setTab] = useState<Tab>('all');
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [cardFilter, setCardFilter] = useState<string | null>(activityFollowsCard ? selectedCardId : null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [recurringOnly, setRecurringOnly] = useState(false);

  // deep links: "View All" bills → ?recurring=1 ; card hand-off is consumed once
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('recurring')) { setRecurringOnly(true); setSearchOpen(true); }
    if (activityFollowsCard) setActivityFollowsCard(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const base = useMemo(() => {
    let list = range ? inRange(transactions, range.from, range.to) : inMonth(transactions, month);
    if (cardFilter) list = list.filter((t) => t.cardId === cardFilter || t.toCardId === cardFilter);
    if (catFilter) list = list.filter((t) => t.categoryId === catFilter);
    if (recurringOnly) list = list.filter((t) => t.recurring);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((t) => {
        const cat = categories.find((c) => c.id === t.categoryId)?.name ?? '';
        const card = cards.find((c) => c.id === t.cardId)?.name ?? '';
        return [t.merchant, cat, card, t.note ?? '', t.date, String(t.amount)].some((s) => s.toLowerCase().includes(q));
      });
    }
    return list;
  }, [transactions, range, month, cardFilter, catFilter, recurringOnly, query, categories, cards]);

  const list = tab === 'all' ? base : base.filter((t) => t.type === tab);
  const groups = useMemo(() => groupByDay(list), [list]);

  const summary = tab === 'income'
    ? { title: 'Total Income', total: sum(incomeOf(base)), slices: byMerchant(incomeOf(base)) }
    : tab === 'transfer'
      ? { title: 'Total Transferred', total: sum(transfersOf(base)), slices: byMerchant(transfersOf(base)) }
      : { title: 'Total Spend', total: sum(expensesOf(base)), slices: byCategory(base, categories) };

  const isArchive = !range && month < activeMonth;
  const label = range
    ? `${fmt(range.from)} – ${fmt(range.to)}`
    : month === monthKey(new Date()) ? new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : monthLabel(month);
  const filters = (cardFilter ? 1 : 0) + (catFilter ? 1 : 0) + (recurringOnly ? 1 : 0);

  return (
    <div>
      {/* top bar */}
      <header className="flex items-center justify-between gap-2">
        <button aria-label="Pick a date range" onClick={() => setCalOpen((v) => !v)} className={`icon-btn ${range ? 'border-accent/40 text-accent' : ''}`}><CalendarDays size={17} /></button>
        <div className="flex min-w-0 items-center gap-1">
          <button aria-label="Previous month" disabled={!!range} onClick={() => setMonth((m) => addMonths(m, -1))} className="pressable grid size-8 place-items-center rounded-full text-label2 disabled:opacity-30"><ChevronLeft size={18} /></button>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={label} className="truncate text-[15px] font-semibold" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15, ease: easeOut }}>
              {label}
            </motion.span>
          </AnimatePresence>
          <button aria-label="Next month" disabled={!!range || month >= monthKey(new Date())} onClick={() => setMonth((m) => addMonths(m, 1))} className="pressable grid size-8 place-items-center rounded-full text-label2 disabled:opacity-30"><ChevronRight size={18} /></button>
        </div>
        <button aria-label="Search" onClick={() => setSearchOpen((v) => !v)} className={`icon-btn relative ${searchOpen || query || filters ? 'border-accent/40 text-accent' : ''}`}>
          <Search size={17} />
          {filters > 0 && <span className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-accent text-[9px] font-bold text-white">{filters}</span>}
        </button>
      </header>
      {isArchive && <p className="mt-1 text-center text-[11px] font-medium text-label3">Archived month · entries stay editable</p>}

      {/* date range */}
      <AnimatePresence initial={false}>
        {calOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: easeOut }} className="overflow-hidden">
            <RangePicker value={range} onChange={(r) => { setRange(r); if (!r) setCalOpen(false); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* search + filters */}
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: easeOut }} className="overflow-hidden">
            <div className="pt-3">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-label3" />
                <input autoFocus className="input rounded-full pl-9 pr-9" placeholder="Search merchant, category, card or note" value={query} onChange={(e) => setQuery(e.target.value)} />
                {query && <button aria-label="Clear search" onClick={() => setQuery('')} className="absolute right-3 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-label3 text-canvas"><X size={11} strokeWidth={3} /></button>}
              </div>
              <div className="no-scrollbar -mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4">
                <button onClick={() => setRecurringOnly((v) => !v)} className={recurringOnly ? 'chip-on' : 'chip-off'}><Repeat size={12} /> Recurring</button>
                {cards.map((c) => (
                  <button key={c.id} onClick={() => setCardFilter((v) => (v === c.id ? null : c.id))} className={cardFilter === c.id ? 'chip-on' : 'chip-off'}>💳 {c.name}</button>
                ))}
                {categories.map((c) => (
                  <button key={c.id} onClick={() => setCatFilter((v) => (v === c.id ? null : c.id))} className={catFilter === c.id ? 'chip-on' : 'chip-off'}>{c.emoji} {c.name}</button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* type tabs */}
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button key={t.value} onClick={() => setTab(t.value)} className={tab === t.value ? 'chip-on' : 'chip-off'}>{t.label}</button>
        ))}
      </div>

      {/* total */}
      <div className="mt-4">
        <SpendBar title={summary.title} total={summary.total} slices={summary.slices} />
      </div>

      {/* list */}
      <div className="mt-1">
        {groups.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-[15px] font-semibold">No transactions</p>
            <p className="mt-1 text-[13px] text-label2">{query || filters ? 'Try a different search or filter.' : 'Tap + to add your first one.'}</p>
          </div>
        )}
        {groups.map((g, gi) => (
          <motion.section key={g.date} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: easeOut, delay: Math.min(gi, 8) * 0.03 }}>
            <DayHeader date={g.date} />
            {g.items.map((t) => <TransactionRow key={t.id} tx={t} onClick={() => openSheet(t)} />)}
          </motion.section>
        ))}
        {groups.length > 0 && <p className="pt-6 text-center text-[11.5px] text-label3">{list.length} transactions · {money(summary.total)}</p>}
      </div>
    </div>
  );
}

const fmt = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

function RangePicker({ value, onChange }: { value: { from: string; to: string } | null; onChange: (r: { from: string; to: string } | null) => void }) {
  const [from, setFrom] = useState(value?.from ?? '');
  const [to, setTo] = useState(value?.to ?? '');
  return (
    <div className="soft-card mt-3 p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11.5px] font-medium text-label2">From<input type="date" className="input mt-1 bg-elevated" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="text-[11.5px] font-medium text-label2">To<input type="date" className="input mt-1 bg-elevated" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {value && <button className="btn-secondary bg-elevated" onClick={() => { setFrom(''); setTo(''); onChange(null); }}>Clear</button>}
        <button className="btn-primary" disabled={!from || !to || from > to} onClick={() => onChange({ from, to })}>Apply range</button>
      </div>
    </div>
  );
}
