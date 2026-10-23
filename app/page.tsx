'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Bell, CalendarDays, Check, ChevronDown, ChevronRight, EllipsisVertical, Eye, EyeOff, Settings } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useSheet } from '@/lib/sheet';
import { useMoney } from '@/lib/format';
import { addMonths, currentMonth, parseISODate } from '@/lib/dates';
import { balanceOf, expensesOf, incomeOf, inMonth, isoToday, sortByDateDesc, sum, touchingCard, upcomingBills } from '@/lib/selectors';
import { TransactionRow } from '@/components/activity/TransactionRow';
import { easeOut, springSnappy } from '@/lib/motion';

export default function HomePage() {
  const money = useMoney();
  const { cards, transactions, categories, budgets, selectedCardId, selectCard, profileName, setActivityFollowsCard } = useStore();
  const openSheet = useSheet((s) => s.open);
  const card = cards.find((c) => c.id === selectedCardId) ?? null;
  const scope = useMemo(() => touchingCard(transactions, card?.id ?? null), [transactions, card]);
  const own = (t: { cardId: string | null }) => !card || t.cardId === card.id;

  const m = currentMonth(), prev = addMonths(m, -1);
  const income = sum(incomeOf(inMonth(scope, m)).filter(own));
  const expense = sum(expensesOf(inMonth(scope, m)).filter(own));
  const lastIncome = sum(incomeOf(inMonth(scope, prev)).filter(own));
  const lastExpense = sum(expensesOf(inMonth(scope, prev)).filter(own));
  const balance = balanceOf(transactions, card?.id ?? null);

  const budgetTotal = budgets.reduce((s, b) => s + b.limit, 0);
  const monthSpentAll = sum(expensesOf(inMonth(transactions, m)));
  const budgetPct = budgetTotal ? monthSpentAll / budgetTotal : 0;

  const bills = useMemo(() => upcomingBills(transactions, isoToday()).slice(0, 3), [transactions]);
  const recent = useMemo(() => sortByDateDesc(scope).slice(0, 5), [scope]);

  const now = new Date();
  const name = profileName.trim() || 'there';
  const initials = (profileName.trim() || 'You').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div>
      {/* greeting */}
      <header className="flex items-center gap-3">
        <Link href="/settings" aria-label="Profile" className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#5b6cff] to-[#2a2ad6] text-[14px] font-semibold text-white">
          {initials}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] text-label">Hi, <span className="font-semibold">{name}!</span></p>
          <p className="text-[12px] text-label2">{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
        <Link href="/budget" aria-label="Budget alerts" className="icon-btn relative">
          <Bell size={17} />
          {budgetPct >= 0.8 && <span className="absolute right-[10px] top-[9px] size-2 rounded-full bg-bad ring-2 ring-elevated" />}
        </Link>
        <Link href="/settings" aria-label="Settings" className="icon-btn"><Settings size={17} /></Link>
      </header>

      {/* balance card */}
      <BalanceCard
        accountLabel={card?.name ?? 'All Accounts'}
        accounts={[{ id: null, label: 'All Accounts' }, ...cards.map((c) => ({ id: c.id as string | null, label: c.name }))]}
        selected={card?.id ?? null}
        onSelect={(id) => selectCard(id)}
        balance={balance} income={income} expense={expense}
        incomeDelta={lastIncome ? (income - lastIncome) / lastIncome : null}
        expenseDelta={lastExpense ? (expense - lastExpense) / lastExpense : null}
      />

      {/* monthly budget */}
      <Link href="/budget" className="panel pressable mt-4 block px-4 pb-4 pt-3.5">
        <div className="text-[14px] font-semibold">Monthly Budget</div>
        {budgetTotal ? (
          <>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-soft">
              <motion.div className={`h-full rounded-full ${budgetPct > 1 ? 'bg-bad' : 'bg-accent'}`}
                initial={{ width: 0 }} animate={{ width: `${Math.min(100, budgetPct * 100)}%` }} transition={{ duration: 0.8, ease: easeOut, delay: 0.1 }} />
            </div>
            <div className="mt-2 flex items-center justify-between text-[12px]">
              <span className="text-label2">Spent <span className="tabular font-semibold text-label">{money(monthSpentAll)}</span> / <span className="tabular">{money(budgetTotal)}</span></span>
              <span className={`tabular font-semibold ${budgetPct > 1 ? 'text-bad' : 'text-accent'}`}>{Math.round(budgetPct * 100)}%</span>
            </div>
          </>
        ) : (
          <p className="mt-1 flex items-center justify-between text-[12.5px] text-label2">Set category budgets to track your month <ChevronRight size={15} /></p>
        )}
      </Link>

      {/* upcoming bills */}
      <section className="panel mt-4 px-4 pb-3 pt-3.5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Upcoming Bills</h2>
          <Link href="/activity/?recurring=1" className="flex items-center gap-0.5 text-[12.5px] font-semibold text-accent">View All <ChevronRight size={14} strokeWidth={2.5} /></Link>
        </div>
        <div className="mt-3 space-y-2">
          {bills.length === 0 && (
            <button onClick={() => openSheet({ recurring: true })} className="soft-card pressable w-full px-3.5 py-3 text-left text-[12.5px] text-label2">
              No recurring bills yet. Add one and set it to <span className="font-semibold text-label">Monthly</span> to see it here.
            </button>
          )}
          {bills.map(({ tx, due, daysLeft }) => {
            const cat = categories.find((c) => c.id === tx.categoryId);
            return (
              <button key={tx.id} onClick={() => openSheet(tx)} className="soft-card pressable flex w-full items-center gap-3 px-3 py-2.5 text-left">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-elevated text-[16px]">{cat?.emoji ?? '🧾'}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{tx.merchant}{cat ? <span className="font-normal text-label2"> - {cat.name}</span> : null}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[11px] text-label2">
                    <CalendarDays size={11} /> Due {parseISODate(due).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    <span className="text-label3">•</span>
                    <span className={daysLeft <= 3 ? 'font-medium text-bad' : ''}>{daysLeft} {daysLeft === 1 ? 'day' : 'days'} left</span>
                  </span>
                </span>
                <span className="tabular text-[13px] font-semibold">{money(tx.amount)}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* recent */}
      <section className="mt-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Recent Transactions</h2>
          <Link href="/activity" onClick={() => setActivityFollowsCard(!!card)} className="flex items-center gap-0.5 text-[12.5px] font-semibold text-accent">View All <ChevronRight size={14} strokeWidth={2.5} /></Link>
        </div>
        <div className="mt-1">
          {recent.length === 0 && (
            <div className="soft-card mt-2 px-4 py-6 text-center text-[13px] text-label2">
              No transactions yet. Tap <span className="font-semibold text-accent">+</span> to add one, or import a file in Profile.
            </div>
          )}
          {recent.map((t, i) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: easeOut, delay: i * 0.03 }}>
              <TransactionRow tx={t} onClick={() => openSheet(t)} />
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

type Account = { id: string | null; label: string };

function BalanceCard({ accountLabel, accounts, selected, onSelect, balance, income, expense, incomeDelta, expenseDelta }: {
  accountLabel: string; accounts: Account[]; selected: string | null; onSelect: (id: string | null) => void;
  balance: number; income: number; expense: number; incomeDelta: number | null; expenseDelta: number | null;
}) {
  const money = useMoney();
  const [hidden, setHidden] = useState(false);
  const [menu, setMenu] = useState(false);
  const full = money(balance);
  const cut = full.lastIndexOf('.');
  const [whole, cents] = cut > 0 ? [full.slice(0, cut), full.slice(cut)] : [full, ''];

  return (
    <div className="relative mt-5">
      <div className="relative overflow-hidden rounded-[22px] px-4 pb-4 pt-3.5 text-white shadow-[0_18px_40px_-18px_rgba(18,32,140,0.75)]"
        style={{ background: 'linear-gradient(135deg, #0a1450 0%, #10248f 45%, #1b3ad6 75%, #2a52ff 100%)' }}>
        {/* diagonal light planes */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0" style={{ background: 'linear-gradient(118deg, transparent 50%, rgba(64,156,255,0.5) 50.2%, rgba(28,86,255,0.12) 68%, transparent 68.2%)' }} />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(118deg, transparent 62%, rgba(0,212,255,0.5) 62.2%, rgba(43,108,255,0.18) 80%, transparent 80.2%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(70% 60% at 0% 110%, rgba(0,0,0,0.35), transparent 70%)' }} />
        </div>

        <div className="relative flex items-center justify-between">
          <button onClick={() => setMenu((v) => !v)} aria-haspopup="listbox" aria-expanded={menu}
            className="pressable flex items-center gap-1.5 rounded-full bg-white/15 py-1 pl-3 pr-2 text-[11.5px] font-medium">
            {accountLabel} <ChevronDown size={13} className={`transition-transform ${menu ? 'rotate-180' : ''}`} />
          </button>
          <Link href="/settings#add-card" aria-label="Manage accounts" className="pressable -mr-1 grid size-7 place-items-center rounded-full hover:bg-white/10"><EllipsisVertical size={16} /></Link>
        </div>

        <div className="relative mt-4 text-[12px] text-white/70">Total Balance</div>
        <div className="relative mt-0.5 flex items-center gap-2.5">
          <span className="tabular text-[32px] font-bold leading-tight tracking-[-0.025em]">
            {hidden ? '••••••' : <>{whole}<span className="text-white/55">{cents}</span></>}
          </span>
          <button aria-label={hidden ? 'Show balance' : 'Hide balance'} onClick={() => setHidden((v) => !v)} className="pressable text-white/75">
            {hidden ? <Eye size={19} /> : <EyeOff size={19} />}
          </button>
        </div>

        <div className="relative mt-4 h-px bg-white/15" />
        <div className="relative mt-3 grid grid-cols-2 gap-3">
          <Stat label="Monthly Income" value={hidden ? '••••' : money(income)} delta={incomeDelta} good="up" />
          <Stat label="Monthly Expense" value={hidden ? '••••' : money(expense)} delta={expenseDelta} good="down" />
        </div>
      </div>

      {menu && <div className="fixed inset-0 z-20" onClick={() => setMenu(false)} aria-hidden />}
      <AnimatePresence>
        {menu && (
          <motion.ul role="listbox"
            initial={{ opacity: 0, scale: 0.96, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: easeOut }} style={{ transformOrigin: 'top left' }}
            className="glass glass-hairline absolute left-3 top-12 z-30 min-w-[210px] rounded-[16px] p-1.5">
            {accounts.map((a) => (
              <li key={a.id ?? 'all'}>
                <button role="option" aria-selected={a.id === selected} onClick={() => { onSelect(a.id); setMenu(false); }}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] hover:bg-soft">
                  <span className="grid w-4 place-items-center text-accent">{a.id === selected && <Check size={14} strokeWidth={2.8} />}</span>
                  {a.label}
                </button>
              </li>
            ))}
            <li className="mt-1 border-t border-line pt-1">
              <Link href="/settings#add-card" className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium text-accent hover:bg-soft">
                <span className="w-4 text-center">+</span> Add a card
              </Link>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Stat({ label, value, delta, good }: { label: string; value: string; delta: number | null; good: 'up' | 'down' }) {
  const up = (delta ?? 0) >= 0;
  const positive = good === 'up' ? up : !up;
  return (
    <div className="min-w-0">
      <div className="text-[11px] text-white/60">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="tabular truncate text-[14px] font-semibold">{value}</span>
        {delta !== null && Number.isFinite(delta) && (
          <motion.span initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={springSnappy}
            className={`tabular flex shrink-0 items-center gap-0.5 rounded-[6px] px-1 py-[1px] text-[10.5px] font-semibold ${positive ? 'bg-[#12b76a]/20 text-[#5ff0a8]' : 'bg-[#f04438]/20 text-[#ff8a80]'}`}>
            {up ? <ArrowUpRight size={11} strokeWidth={2.6} /> : <ArrowDownRight size={11} strokeWidth={2.6} />}
            {Math.abs(delta * 100).toFixed(1)}%
          </motion.span>
        )}
      </div>
    </div>
  );
}
