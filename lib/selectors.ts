import type { Card, Category, Transaction } from './types';
import { addMonths, daysInMonth, monthKey, monthLabel, parseISODate, toISODate } from './dates';
import { cardAccent } from '@/components/card/themes';

/** Pure derivations: every page computes its view from the same raw store data. */

export const expensesOf = (txs: Transaction[]) => txs.filter((t) => t.type === 'expense');
export const incomeOf = (txs: Transaction[]) => txs.filter((t) => t.type === 'income');
export const sum = (txs: Transaction[]) => txs.reduce((a, t) => a + t.amount, 0);

export const forCard = (txs: Transaction[], cardId: string | null) =>
  cardId ? txs.filter((t) => t.cardId === cardId) : txs;
export const inMonth = (txs: Transaction[], key: string) => txs.filter((t) => monthKey(t.date) === key);
export const inRange = (txs: Transaction[], from?: string, to?: string) =>
  txs.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));

export const sortByDateDesc = (txs: Transaction[]) =>
  [...txs].sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));

export interface Slice { id: string; label: string; value: number; color: string; emoji?: string }

export function byCategory(txs: Transaction[], categories: Category[]): Slice[] {
  const map = new Map<string, number>();
  for (const t of expensesOf(txs)) map.set(t.categoryId ?? '_none', (map.get(t.categoryId ?? '_none') ?? 0) + t.amount);
  return [...map.entries()]
    .map(([id, value]) => {
      const c = categories.find((x) => x.id === id);
      return { id, value, label: c?.name ?? 'Uncategorised', color: c?.color ?? '#8E8E93', emoji: c?.emoji ?? '•' };
    })
    .sort((a, b) => b.value - a.value);
}

export function byCard(txs: Transaction[], cards: Card[]): Slice[] {
  const map = new Map<string, number>();
  for (const t of expensesOf(txs)) map.set(t.cardId ?? '_none', (map.get(t.cardId ?? '_none') ?? 0) + t.amount);
  return [...map.entries()]
    .map(([id, value]) => {
      const c = cards.find((x) => x.id === id);
      return { id, value, label: c?.name ?? 'Other', color: c ? cardAccent(c) : '#8E8E93' };
    })
    .sort((a, b) => b.value - a.value);
}

export interface MonthBar { key: string; label: string; segments: { id: string; value: number; color: string; label: string }[]; total: number }

/** Last `n` months of expense totals, optionally split into segments (one per card in overview). */
export function monthlyBars(txs: Transaction[], endMonth: string, n: number, split?: { cards: Card[] }): MonthBar[] {
  const out: MonthBar[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const key = addMonths(endMonth, -i);
    const m = expensesOf(inMonth(txs, key));
    const segments = split
      ? byCard(m, split.cards).map((s) => ({ id: s.id, value: s.value, color: s.color, label: s.label }))
      : [{ id: 'all', value: sum(m), color: '', label: 'Spent' }];
    out.push({ key, label: monthLabel(key, 'short'), segments, total: sum(m) });
  }
  return out;
}

/** Cumulative daily spend for a month (length = days in month; future days are null). */
export function cumulativeDaily(txs: Transaction[], key: string, untilDay?: number): (number | null)[] {
  const days = daysInMonth(key);
  const daily = new Array(days).fill(0);
  for (const t of expensesOf(inMonth(txs, key))) daily[Number(t.date.slice(8, 10)) - 1] += t.amount;
  let run = 0;
  return daily.map((v, i) => {
    if (untilDay !== undefined && i + 1 > untilDay) return null;
    run += v;
    return run;
  });
}

export function groupByDay(txs: Transaction[]) {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const t of sortByDateDesc(txs)) {
    const g = groups[groups.length - 1];
    if (g && g.date === t.date) g.items.push(t);
    else groups.push({ date: t.date, items: [t] });
  }
  return groups;
}

export function monthsWithData(txs: Transaction[]) {
  return [...new Set(txs.map((t) => monthKey(t.date)))].sort().reverse();
}

export const transfersOf = (txs: Transaction[]) => txs.filter((t) => t.type === 'transfer');

/** Card scope that also catches transfers arriving into the card. */
export const touchingCard = (txs: Transaction[], cardId: string | null) =>
  cardId ? txs.filter((t) => t.cardId === cardId || t.toCardId === cardId) : txs;

/** Net balance: income − expenses, ± transfers when scoped to one account. */
export function balanceOf(txs: Transaction[], cardId: string | null) {
  let b = 0;
  for (const t of txs) {
    if (t.type === 'transfer') {
      if (!cardId) continue;
      if (t.cardId === cardId) b -= t.amount;
      if (t.toCardId === cardId) b += t.amount;
    } else if (!cardId || t.cardId === cardId) b += t.type === 'income' ? t.amount : -t.amount;
  }
  return b;
}

/** Spend per calendar day of a month (null for days still in the future). */
export function dailySpend(txs: Transaction[], key: string, untilDay?: number) {
  const days = daysInMonth(key);
  const out: { date: string; value: number | null; count: number }[] = [];
  for (let d = 1; d <= days; d++) out.push({ date: `${key}-${String(d).padStart(2, '0')}`, value: untilDay !== undefined && d > untilDay ? null : 0, count: 0 });
  for (const t of expensesOf(inMonth(txs, key))) {
    const o = out[Number(t.date.slice(8, 10)) - 1];
    if (o.value !== null) { o.value += t.amount; o.count++; }
  }
  return out;
}

/** Next due date for each recurring outflow (bills and scheduled transfers). */
export function upcomingBills(txs: Transaction[], todayIso: string) {
  const latest = new Map<string, Transaction>();
  for (const t of txs) {
    if (!t.recurring || t.type === 'income') continue;
    const k = t.seriesId ?? t.merchant.toLowerCase();
    const p = latest.get(k);
    if (!p || t.date > p.date) latest.set(k, t);
  }
  const out: { tx: Transaction; due: string; daysLeft: number }[] = [];
  latest.forEach((t) => {
    const day = Number(t.date.slice(8, 10));
    let m = monthKey(t.date);
    let due = t.date;
    while (due <= todayIso) {
      m = addMonths(m, 1);
      due = `${m}-${String(Math.min(day, daysInMonth(m))).padStart(2, '0')}`;
    }
    const daysLeft = Math.round((parseISODate(due).getTime() - parseISODate(todayIso).getTime()) / 86400000);
    out.push({ tx: t, due, daysLeft });
  });
  return out.sort((a, b) => a.due.localeCompare(b.due));
}

export const SEGMENT_PALETTE = ['#2E5BEA', '#3AA676', '#F4C542', '#F0582B', '#7A5AF8', '#22B8CF'];

/** Top-N groups + "Others" for the stacked spend bar. */
export function topGroups(slices: Slice[], n = 4): Slice[] {
  if (slices.length <= n + 1) return slices;
  const head = slices.slice(0, n);
  const rest = slices.slice(n).reduce((a, s) => a + s.value, 0);
  return [...head, { id: '_others', label: 'Others', value: rest, color: '#D0D5DD' }];
}

export function byMerchant(txs: Transaction[]): Slice[] {
  const map = new Map<string, number>();
  for (const t of txs) map.set(t.merchant, (map.get(t.merchant) ?? 0) + t.amount);
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ id: label, label, value, color: SEGMENT_PALETTE[i % SEGMENT_PALETTE.length] }));
}

export const isoToday = () => toISODate(new Date());
