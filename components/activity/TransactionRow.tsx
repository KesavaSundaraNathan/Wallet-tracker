'use client';

import { ArrowLeftRight, Repeat } from 'lucide-react';
import type { Transaction } from '@/lib/types';
import { useStore } from '@/lib/store';
import { useMoney } from '@/lib/format';
import { parseISODate } from '@/lib/dates';

/** Icon well + title/subtitle on the left, signed amount + type on the right. */
export function TransactionRow({ tx, onClick, sub }: { tx: Transaction; onClick?: () => void; sub?: string }) {
  const money = useMoney();
  const cat = useStore((s) => s.categories.find((c) => c.id === tx.categoryId));
  const cards = useStore((s) => s.cards);
  const card = cards.find((c) => c.id === tx.cardId);
  const to = cards.find((c) => c.id === tx.toCardId);

  const subtitle = sub ?? (tx.type === 'transfer'
    ? `${card?.name ?? 'Account'} → ${to?.name ?? 'Account'}`
    : tx.type === 'income' ? (card ? card.name : 'Income') : cat?.name ?? 'Uncategorised');
  const amountText = tx.type === 'transfer' ? money(tx.amount) : money(tx.type === 'income' ? tx.amount : -tx.amount, { sign: true });

  return (
    <button onClick={onClick} className="pressable flex w-full items-center gap-3 rounded-[14px] py-2.5 text-left">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-soft text-[18px]">
        {tx.type === 'transfer' ? <ArrowLeftRight size={17} className="text-label2" /> : tx.type === 'income' ? '💰' : cat?.emoji ?? '🧾'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{tx.merchant}</span>
          {tx.recurring && <Repeat size={12} className="shrink-0 text-accent" aria-label="Recurring monthly" />}
        </span>
        <span className="block truncate text-[12px] text-label2">{subtitle}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className={`tabular block text-[14px] font-semibold ${tx.type === 'income' ? 'text-ok' : tx.type === 'expense' ? 'text-bad' : 'text-label'}`}>
          {amountText.replace('−', '-')}
        </span>
        <span className="block text-[11px] text-label3">{tx.type === 'income' ? 'Income' : tx.type === 'transfer' ? 'Transfer' : 'Expense'}</span>
      </span>
    </button>
  );
}

/** "21  Mon  10.2026 ———" */
export function DayHeader({ date }: { date: string }) {
  const d = parseISODate(date);
  return (
    <div className="flex items-center gap-2 pb-1 pt-5">
      <span className="tabular text-[18px] font-bold leading-none">{d.getDate()}</span>
      <span className="rounded-[6px] border border-line px-1.5 py-[2px] text-[10.5px] font-medium text-label2">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
      <span className="tabular text-[11.5px] text-label3">{String(d.getMonth() + 1).padStart(2, '0')}.{d.getFullYear()}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
