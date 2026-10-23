'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChevronLeft, Lock, Plus, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSheet } from '@/lib/sheet';
import { useMoney } from '@/lib/format';
import { currentMonth, monthLabel } from '@/lib/dates';
import { expensesOf, incomeOf, inMonth, sortByDateDesc, sum } from '@/lib/selectors';
import type { Budget, Category } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { TransactionRow } from '@/components/activity/TransactionRow';
import { ChartFullscreen } from '@/components/charts/ChartFullscreen';
import { easeOut, listItem, springSnappy } from '@/lib/motion';

const COLORS = ['#2E5BEA', '#3AA676', '#F4C542', '#F0582B', '#7A5AF8', '#22B8CF', '#EE46BC', '#0BA5EC', '#F79009', '#12B76A', '#F04438', '#98A2B3'];
const EMOJIS = ['🍜', '🛒', '🚇', '🛍️', '💡', '🎬', '🩺', '✈️', '🏠', '🎓', '🐾', '🎁', '💼', '☕️', '🏋️', '🏷️'];

export default function BudgetPage() {
  const money = useMoney();
  const { transactions, categories, budgets, setBudget, deleteBudget, addCategory, deleteCategory } = useStore();
  const openSheet = useSheet((s) => s.open);
  const m = currentMonth();
  const monthTx = useMemo(() => inMonth(transactions, m), [transactions, m]);
  const income = sum(incomeOf(monthTx));
  const spent = sum(expensesOf(monthTx));
  const budgeted = budgets.reduce((s, b) => s + b.limit, 0);
  const remaining = income - spent;
  const usedPct = income ? spent / income : spent ? 1 : 0;

  const [budgetModal, setBudgetModal] = useState<{ budget?: Budget } | null>(null);
  const [catModal, setCatModal] = useState(false);

  const spentIn = (catId: string) => sum(expensesOf(monthTx).filter((t) => t.categoryId === catId));
  const unbudgeted = categories.filter((c) => !budgets.some((b) => b.categoryId === c.id));
  const canAddBudget = categories.length > 0 && unbudgeted.length > 0;

  return (
    <div>
      <header className="flex items-center justify-between">
        <Link href="/" aria-label="Back" className="icon-btn lg:hidden"><ChevronLeft size={18} /></Link>
        <h1 className="text-[16px] font-semibold lg:text-[24px] lg:font-bold lg:tracking-[-0.02em]">Budget</h1>
        <button aria-label="New budget" disabled={!canAddBudget} onClick={() => setBudgetModal({})} className="icon-btn disabled:opacity-40">
          {categories.length ? <Plus size={18} /> : <Lock size={15} />}
        </button>
      </header>

      <div className="mt-5 flex flex-col gap-6 lg:mt-2 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-x-8">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
      {/* income vs expense */}
      <section className="panel order-1 px-4 pb-4 pt-3.5">
        <div className="flex items-center justify-between text-[12px] text-label2">
          <span>Remaining balance · {monthLabel(m)}</span>
        </div>
        <div className={`tabular mt-1 text-[30px] font-bold leading-tight tracking-[-0.025em] ${remaining < 0 ? 'text-bad' : ''}`}>{money(remaining)}</div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-soft">
          <motion.div className={`h-full rounded-full ${usedPct > 1 ? 'bg-bad' : 'bg-accent'}`}
            initial={{ width: 0 }} animate={{ width: `${Math.min(100, usedPct * 100)}%` }} transition={{ duration: 0.8, ease: easeOut, delay: 0.1 }} />
        </div>
        <p className="mt-2 text-[11.5px] text-label2">{income ? `${Math.round(usedPct * 100)}% of income spent` : 'Add income to track your balance'}</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ['Income', money(income), 'text-ok'],
            ['Expense', money(spent), 'text-bad'],
            ['Budgeted', money(budgeted), income && budgeted > income ? 'text-warn' : ''],
          ].map(([label, value, cls]) => (
            <div key={label} className="soft-card min-w-0 px-2.5 py-2.5">
              <div className="text-[11px] text-label2">{label}</div>
              <div className={`tabular mt-0.5 truncate text-[12.5px] font-semibold tracking-[-0.01em] ${cls}`}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* income this month */}
      <section className="order-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Income this month</h3>
          <button className="btn-plain -mt-2 h-7" onClick={() => openSheet({ type: 'income' })}><Plus size={14} /> Add income</button>
        </div>
        {incomeOf(monthTx).length === 0 && <p className="soft-card px-4 py-5 text-center text-[13px] text-label2">No income recorded for {monthLabel(m)}.</p>}
        {sortByDateDesc(incomeOf(monthTx)).map((t) => <TransactionRow key={t.id} tx={t} onClick={() => openSheet(t)} />)}
      </section>

      </div>
      <div className="contents lg:flex lg:flex-col lg:gap-6">
      {/* budgets */}
      <section className="order-2">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Category budgets</h3>
          {budgets.length > 0 && (
            <div className="-mt-2">
              <ChartFullscreen title="Category budgets" subtitle={monthLabel(m)}>
                {({ height }) => (
                  <div className="mx-auto w-full max-w-[1100px]">
                    {budgets.map((b, i) => {
                      const cat = categories.find((c) => c.id === b.categoryId);
                      if (!cat) return null;
                      const sp = spentIn(b.categoryId), p = sp / b.limit;
                      return (
                        <div key={b.id} className="flex items-center gap-4" style={{ height: Math.max(48, Math.min(72, (height - 20) / budgets.length)) }}>
                          <span className="w-[30%] truncate text-[14px] font-medium">{cat.emoji} {cat.name}</span>
                          <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-soft">
                            <motion.span className="absolute inset-y-0 left-0 rounded-full" style={{ background: p > 1 ? 'rgb(var(--red))' : cat.color }}
                              initial={{ width: 0 }} animate={{ width: `${Math.min(100, p * 100)}%` }} transition={{ duration: 0.7, ease: easeOut, delay: i * 0.04 }} />
                          </span>
                          <span className={`tabular w-12 text-right text-[13px] font-semibold ${p > 1 ? 'text-bad' : 'text-accent'}`}>{Math.round(p * 100)}%</span>
                          <span className="tabular w-48 text-right text-[13px] text-label2"><span className="font-semibold text-label">{money(sp)}</span> / {money(b.limit)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ChartFullscreen>
            </div>
          )}
        </div>
        {!categories.length ? (
          <div className="soft-card flex items-center gap-3 p-4">
            <span className="grid size-10 place-items-center rounded-full bg-warn/15 text-warn"><Lock size={17} /></span>
            <div className="flex-1">
              <div className="text-[14px] font-semibold">Define a category first</div>
              <div className="text-[12px] text-label2">Budgets are set per category, so create one to begin.</div>
            </div>
            <button className="btn-primary" onClick={() => setCatModal(true)}>New</button>
          </div>
        ) : budgets.length === 0 ? (
          <button onClick={() => setBudgetModal({})} className="soft-card pressable flex w-full flex-col items-center gap-1 p-6 text-center">
            <span className="text-[14px] font-semibold">No budgets yet</span>
            <span className="text-[12px] text-label2">Set a monthly limit for any category.</span>
          </button>
        ) : (
          <div className="panel divide-y divide-line overflow-hidden">
            <AnimatePresence initial={false}>
              {budgets.map((b, i) => {
                const cat = categories.find((c) => c.id === b.categoryId)!;
                const s = spentIn(b.categoryId), p = s / b.limit, left = b.limit - s;
                return (
                  <motion.button key={b.id} layout {...listItem(i)} exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    onClick={() => setBudgetModal({ budget: b })}
                    className="pressable flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft text-[18px]">{cat.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[14px] font-semibold">{cat.name}</span>
                        <span className={`tabular shrink-0 text-[12px] font-semibold ${p > 1 ? 'text-bad' : p > 0.85 ? 'text-warn' : 'text-accent'}`}>{Math.round(p * 100)}%</span>
                      </span>
                      <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-soft">
                        <motion.span className="block h-full rounded-full" style={{ background: p > 1 ? 'rgb(var(--red))' : cat.color }}
                          initial={{ width: 0 }} animate={{ width: `${Math.min(100, p * 100)}%` }} transition={{ duration: 0.8, ease: easeOut, delay: 0.1 + i * 0.05 }} />
                      </span>
                      <span className="mt-1 flex justify-between text-[11.5px] text-label2">
                        <span className="tabular">Spent <span className="font-semibold text-label">{money(s)}</span> / {money(b.limit)}</span>
                        <span className={`tabular ${left < 0 ? 'font-medium text-bad' : ''}`}>{left < 0 ? `${money(-left)} over` : `${money(left)} left`}</span>
                      </span>
                    </span>
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* categories */}
      <section className="order-3">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Categories</h3>
          <button className="btn-plain -mt-2 h-7" onClick={() => setCatModal(true)}><Plus size={14} /> New category</button>
        </div>
        <div className="flex flex-wrap gap-2">
          <AnimatePresence initial={false}>
            {categories.map((c) => (
              <motion.span key={c.id} layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }} transition={springSnappy}
                className="group inline-flex h-8 items-center gap-1.5 rounded-full bg-soft pl-3 pr-1.5 text-[12.5px] font-medium">
                <span className="size-[7px] rounded-full" style={{ background: c.color }} />
                {c.emoji} {c.name}
                <button aria-label={`Delete ${c.name}`} onClick={() => deleteCategory(c.id)}
                  className="grid size-5 place-items-center rounded-full text-label3 transition-colors hover:bg-bad/10 hover:text-bad">
                  <Trash2 size={11} />
                </button>
              </motion.span>
            ))}
          </AnimatePresence>
        </div>
      </section>

      </div>
      </div>

      <BudgetModal state={budgetModal} onClose={() => setBudgetModal(null)} categories={categories} unbudgeted={unbudgeted} setBudget={setBudget} deleteBudget={deleteBudget} />
      <CategoryModal open={catModal} onClose={() => setCatModal(false)} onCreate={(c) => addCategory(c)} existing={categories} />
    </div>
  );
}

function BudgetModal({ state, onClose, categories, unbudgeted, setBudget, deleteBudget }: {
  state: { budget?: Budget } | null; onClose: () => void; categories: Category[]; unbudgeted: Category[];
  setBudget: (catId: string, limit: number) => boolean; deleteBudget: (id: string) => void;
}) {
  const editing = state?.budget;
  const [catId, setCatId] = useState('');
  const [limit, setLimit] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const options = editing ? categories.filter((c) => c.id === editing.categoryId) : unbudgeted;

  // sync form when opened
  const key = state ? editing?.id ?? 'new' : null;
  const [lastKey, setLastKey] = useState<string | null>(null);
  if (key !== lastKey) {
    setLastKey(key);
    setCatId(editing?.categoryId ?? unbudgeted[0]?.id ?? '');
    setLimit(editing ? String(editing.limit) : '');
    setErr(null);
  }

  const save = () => {
    if (!catId) return setErr('Choose a category — budgets must belong to a defined category.');
    const n = Number(limit);
    if (!(n > 0)) return setErr('Enter a monthly limit greater than zero.');
    if (!setBudget(catId, n)) return setErr('That category no longer exists.');
    onClose();
  };

  return (
    <Modal open={!!state} onClose={onClose} title={editing ? 'Edit budget' : 'New budget'} width={440}
      footer={<>
        {editing && <button className="btn-danger mr-auto" onClick={() => { deleteBudget(editing.id); onClose(); }}><Trash2 size={14} /> Remove</button>}
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={!options.length} onClick={save}>Save</button>
      </>}>
      <div className="space-y-4">
        <Field label="Category of expense" hint={!editing && !options.length ? 'Every category already has a budget.' : undefined}>
          <Select value={catId} disabled={!!editing || !options.length} onChange={setCatId} placeholder={options.length ? 'Choose a category' : 'No categories available'}
            options={options.map((c) => ({ value: c.id, label: `${c.emoji} ${c.name}` }))} />
        </Field>
        <Field label="Monthly limit" error={err}>
          <input className="input tabular" inputMode="decimal" placeholder="0.00" value={limit} onChange={(e) => setLimit(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
        </Field>
      </div>
    </Modal>
  );
}

function CategoryModal({ open, onClose, onCreate, existing }: { open: boolean; onClose: () => void; onCreate: (c: Omit<Category, 'id'>) => void; existing: Category[] }) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('🏷️');
  const [color, setColor] = useState(COLORS[2]);
  const [touched, setTouched] = useState(false);
  const dup = existing.some((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  const err = !name.trim() ? 'Name the category' : dup ? 'A category with this name exists' : null;
  const save = () => {
    setTouched(true);
    if (err) return;
    onCreate({ name: name.trim(), emoji, color });
    setName(''); setTouched(false); onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title="New category" width={440}
      footer={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}>Create</button></>}>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-full text-[24px]" style={{ background: `${color}26` }}>{emoji}</span>
          <Field label="Name" error={touched ? err : null} className="flex-1">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pets, Education" autoFocus onKeyDown={(e) => e.key === 'Enter' && save()} />
          </Field>
        </div>
        <div>
          <div className="mb-1.5 text-footnote font-medium text-label2">Icon</div>
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map((e) => (
              <button key={e} onClick={() => setEmoji(e)} className={`pressable grid size-9 place-items-center rounded-[10px] text-[18px] ${emoji === e ? 'bg-accent/15 ring-2 ring-accent' : 'hover:bg-soft'}`}>{e}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-footnote font-medium text-label2">Colour</div>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} aria-label={c} onClick={() => setColor(c)} className="pressable size-7 rounded-full" style={{ background: c, boxShadow: color === c ? `0 0 0 2px rgb(var(--elevated)), 0 0 0 4px ${c}` : undefined }} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
