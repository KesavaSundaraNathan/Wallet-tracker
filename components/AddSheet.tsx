'use client';

import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowRight, CalendarDays, CreditCard, Delete, Mic, Repeat, Tag, Trash2, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSheet, type Draft } from '@/lib/sheet';
import { currentMonth, parseISODate } from '@/lib/dates';
import { expensesOf, inMonth, sum } from '@/lib/selectors';
import { easeOut, springSheet, springSnappy } from '@/lib/motion';
import { Select } from '@/components/ui/Select';
import { useIsDesktop } from '@/lib/useMedia';
import { useVoice } from '@/lib/voice';
import type { TxType } from '@/lib/types';

const TABS: { value: TxType; label: string }[] = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' },
];
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

/** Currency symbol for the amount display (e.g. "RM", "$"). */
function symbolFor(currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).formatToParts(0).find((p) => p.type === 'currency')?.value ?? currency;
  } catch { return currency; }
}

/** Bottom sheet with a keypad, used for adding and editing every transaction. */
export function AddSheet() {
  const draft = useSheet((s) => s.draft);
  const close = useSheet((s) => s.close);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!draft) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [draft]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {draft && (
        <motion.div key="sheet" className="fixed inset-0 z-50" initial={{ opacity: 1 }} exit={{ opacity: 1, transition: { duration: 0.25 } }}>
          <motion.div className="absolute inset-0 bg-black/40" onClick={close}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22, ease: easeOut }} />
          <SheetBody draft={draft} onClose={close} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function SheetBody({ draft, onClose }: { draft: Draft; onClose: () => void }) {
  const { cards, categories, budgets, transactions, currency, upsertTransaction, deleteTransaction } = useStore();
  const [d, setD] = useState<Draft>(draft);
  const [amount, setAmount] = useState(draft.amount ? String(Math.round(draft.amount * 100) / 100) : '');
  const [alertOff, setAlertOff] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((p) => ({ ...p, [k]: v })); setErr(null); };
  const editing = !!draft.id;
  const desktop = useIsDesktop();
  const openVoice = useVoice((s) => s.openVoice);

  // budget alert: share of this month's total budget already spent
  const budgetPct = useMemo(() => {
    const total = budgets.reduce((s, b) => s + b.limit, 0);
    if (!total) return null;
    return sum(expensesOf(inMonth(transactions, currentMonth()))) / total;
  }, [budgets, transactions]);

  const press = (k: string) => {
    setErr(null);
    setAmount((a) => {
      if (k === 'del') return a.slice(0, -1);
      if (k === '.') return a.includes('.') ? a : (a || '0') + '.';
      if (a.includes('.') && a.split('.')[1].length >= 2) return a;
      if (a === '0') return k;
      if (a.replace('.', '').length >= 9) return a;
      return a + k;
    });
  };

  const save = () => {
    const n = Number(amount);
    if (!(n > 0)) return setErr('Enter an amount');
    if (d.type === 'transfer' && cards.length >= 2 && (!d.cardId || !d.toCardId || d.cardId === d.toCardId)) return setErr('Pick two different accounts');
    const cat = categories.find((c) => c.id === d.categoryId);
    const fallback = d.type === 'transfer' ? 'Transfer' : d.type === 'income' ? 'Income' : cat?.name ?? 'Expense';
    upsertTransaction({
      ...d,
      amount: Math.round(n * 100) / 100,
      merchant: d.merchant.trim() || fallback,
      categoryId: d.type === 'expense' ? d.categoryId : null,
      toCardId: d.type === 'transfer' ? d.toCardId : null,
      recurring: d.recurring,
    });
    onClose();
  };

  // physical keyboard: digits, dot, backspace, enter, escape
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA') return;
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === '.' || e.key === ',') press('.');
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') saveRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 600) onClose();
  };

  const dateLabel = parseISODate(d.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const cardOptions = (empty: string) => [{ value: '', label: empty }, ...cards.map((c) => ({ value: c.id, label: c.name, hint: c.last4 ? `•• ${c.last4}` : undefined }))];
  const [int, dec] = (amount || '0').split('.');

  return (
    <div className="pointer-events-none absolute inset-0 flex items-end justify-center lg:items-center lg:p-8">
    <motion.div
      role="dialog" aria-modal="true" aria-label={editing ? 'Edit transaction' : 'Add transaction'}
      className="pointer-events-auto flex max-h-[94svh] w-full max-w-[440px] flex-col rounded-t-[28px] bg-elevated lg:max-h-[92vh] lg:rounded-[28px] lg:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)]"
      initial={desktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
      animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
      exit={desktop ? { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16, ease: easeOut } } : { y: '100%', transition: { duration: 0.24, ease: easeOut } }}
      transition={springSheet}
      drag={desktop ? false : 'y'} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.6 }} onDragEnd={onDragEnd}
    >
      <div className="mx-auto mb-1 mt-2.5 h-[5px] w-10 shrink-0 cursor-grab rounded-full bg-label3/40 lg:invisible lg:mt-1" />
      <div className="overflow-y-auto px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-2">
        {/* type tabs */}
        <TypeTabs value={d.type} onChange={(t) => set('type', t)} />
        {!editing && (
          <button onClick={() => { onClose(); setTimeout(openVoice, 200); }} className="pressable mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold text-accent">
            <Mic size={13} /> Speak instead <span className="font-normal text-label3">· or double-click + · hold + 3s on phone</span>
          </button>
        )}

        {/* budget alert */}
        <AnimatePresence initial={false}>
          {d.type === 'expense' && budgetPct !== null && budgetPct >= 0.5 && !alertOff && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: easeOut }} className="overflow-hidden">
              <div className="soft-card mt-3 flex items-start gap-3 px-3.5 py-3">
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white ${budgetPct >= 1 ? 'bg-bad' : 'bg-[#4DA3FF]'}`}>!</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">Budget Alert</div>
                  <div className="text-[11.5px] text-label2">You’ve spent {Math.round(budgetPct * 100)}% of your monthly budget</div>
                </div>
                <button aria-label="Dismiss" onClick={() => setAlertOff(true)} className="pressable -m-1 grid size-6 place-items-center rounded-full text-accent"><X size={14} strokeWidth={2.5} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* amount */}
        <div className="mt-5 text-center">
          <div className="text-[14px] text-label2">Amount</div>
          <div className={`tabular mt-1 text-[40px] font-bold leading-[1.15] tracking-[-0.03em] ${err && !(Number(amount) > 0) ? 'text-bad' : ''}`}>
            {symbolFor(currency)}{/^[A-Za-z]{2,}$/.test(symbolFor(currency)) ? ' ' : ''}{Number(int).toLocaleString()}{amount.includes('.') && <>.{dec}</>}
            {!amount.includes('.') && <span className="text-label3">.00</span>}
          </div>
          <input
            value={d.merchant} onChange={(e) => set('merchant', e.target.value)} maxLength={40}
            placeholder={d.type === 'income' ? 'Add a source (e.g. Salary)' : d.type === 'transfer' ? 'Add a note' : 'Add a title (e.g. Netflix)'}
            className="mx-auto mt-1 block w-full max-w-[260px] rounded-full bg-transparent px-3 py-1 text-center text-[14px] text-label outline-hidden placeholder:text-label3 focus:bg-soft"
          />
        </div>

        {/* pickers */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {d.type === 'expense' && (
            <Select variant="pill" icon={<Tag size={14} />} value={d.categoryId ?? ''} onChange={(v) => set('categoryId', v || null)} placeholder="Category"
              options={[{ value: '', label: 'Uncategorised' }, ...categories.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))]} />
          )}
          {d.type === 'income' && (
            <Select variant="pill" icon={<CreditCard size={14} />} value={d.cardId ?? ''} onChange={(v) => set('cardId', v || null)} options={cardOptions('Not linked')} />
          )}
          {d.type === 'transfer' && (
            <Select variant="pill" icon={<CreditCard size={14} />} value={d.cardId ?? ''} onChange={(v) => set('cardId', v || null)} placeholder="From" options={cardOptions('From…')} />
          )}
          <button type="button" onClick={() => { try { dateRef.current?.showPicker(); } catch { dateRef.current?.focus(); } }}
            className="pressable relative flex h-10 items-center gap-2 rounded-full border border-line bg-elevated px-3.5 text-left text-[13px] font-medium">
            <CalendarDays size={14} className="shrink-0 text-label2" />
            <span className="flex-1 truncate">{dateLabel}</span>
            <input ref={dateRef} type="date" value={d.date} onChange={(e) => e.target.value && set('date', e.target.value)} tabIndex={-1} aria-label="Date"
              className="pointer-events-none absolute inset-0 opacity-0" />
          </button>
          {d.type === 'expense' && (
            <Select variant="pill" icon={<CreditCard size={14} />} value={d.cardId ?? ''} onChange={(v) => set('cardId', v || null)} options={cardOptions('Cash / other')} />
          )}
          {d.type === 'transfer' && (
            <Select variant="pill" icon={<ArrowRight size={14} />} value={d.toCardId ?? ''} onChange={(v) => set('toCardId', v || null)} placeholder="To" options={cardOptions('To…')} />
          )}
          {(
            <button type="button" onClick={() => set('recurring', !d.recurring)} aria-pressed={!!d.recurring}
              className={`pressable flex h-10 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors ${d.recurring ? 'border-accent/30 bg-accent/10 text-accent' : 'border-line bg-elevated text-label'}`}>
              <Repeat size={14} className={d.recurring ? '' : 'text-label2'} /> {d.recurring ? 'Monthly' : 'One-time'}
            </button>
          )}
        </div>

        {/* keypad */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <motion.button key={k} type="button" whileTap={{ scale: 0.94 }} transition={springSnappy} onClick={() => press(k)}
              aria-label={k === 'del' ? 'Delete' : k}
              className="grid h-[52px] place-items-center rounded-[14px] bg-soft text-[20px] font-medium text-label transition-colors active:bg-line">
              {k === 'del' ? <Delete size={20} /> : k}
            </motion.button>
          ))}
        </div>

        {err && <p className="mt-3 text-center text-[12px] font-medium text-bad">{err}</p>}
        <button className="btn-big mt-4" onClick={save}>{editing ? 'Save Changes' : 'Add Transaction'}</button>
        {editing && (
          <button className="pressable mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-semibold text-bad" onClick={() => { deleteTransaction(draft.id!); onClose(); }}>
            <Trash2 size={14} /> Delete transaction
          </button>
        )}
      </div>
    </motion.div>
    </div>
  );
}

/** Black sliding pill inside a soft track (Income / Expense / Transfer). */
export function TypeTabs<T extends string>({ value, onChange, options = TABS as unknown as { value: T; label: string }[] }: {
  value: T; onChange: (v: T) => void; options?: { value: T; label: string }[];
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [rect, setRect] = useState<{ x: number; w: number } | null>(null);
  const idx = options.findIndex((o) => o.value === value);
  useLayoutEffect(() => {
    const el = refs.current[idx];
    if (el) setRect({ x: el.offsetLeft, w: el.offsetWidth });
  }, [idx, options.length]);
  return (
    <div role="radiogroup" className="relative flex rounded-full bg-soft p-1">
      {rect && (
        <motion.span aria-hidden className="absolute inset-y-1 left-0 rounded-full bg-ink" initial={false} animate={{ x: rect.x, width: rect.w }} transition={springSnappy} />
      )}
      {options.map((o, i) => (
        <button key={o.value} ref={(el) => { refs.current[i] = el; }} role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={`relative h-9 flex-1 rounded-full text-[13px] font-semibold transition-colors duration-150 ${o.value === value ? 'text-onink' : 'text-label2'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
