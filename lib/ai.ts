'use client';

import type { Card, Category, Transaction } from './types';
import { addDays, parseISODate, today as todayIso, toISODate } from './dates';
import type { Draft } from './sheet';

/** What the worker (or the offline parser) returns. Names, not ids. */
export interface AiTx {
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  date: string;
  title: string;
  category: string | null;
  newCategory?: string | null;
  account: string | null;
  toAccount: string | null;
  recurring: boolean;
  note?: string | null;
}
export interface AiResult { transactions: AiTx[]; question: string | null; reply: string; offline?: boolean }
export interface ChatMsg { role: 'user' | 'assistant'; content: string }

/** Build-time default (public, not a secret): the Cloudflare Worker URL. */
export const DEFAULT_AI_ENDPOINT = (process.env.NEXT_PUBLIC_AI_ENDPOINT || '').replace(/\/$/, '');

export function aiContext(categories: Category[], cards: Card[], currency: string) {
  const t = todayIso();
  return {
    today: t,
    weekday: parseISODate(t).toLocaleDateString('en-US', { weekday: 'long' }),
    currency,
    categories: categories.map((c) => c.name),
    accounts: cards.map((c) => c.name),
  };
}

export async function checkEndpoint(endpoint: string): Promise<{ ok: boolean; message: string }> {
  try {
    const r = await fetch(`${endpoint.replace(/\/$/, '')}/health`, { method: 'GET' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, message: j.error || `Worker answered ${r.status}` };
    return j.ok ? { ok: true, message: `Connected · ${j.model}` } : { ok: false, message: 'Worker reached, but the NVIDIA secret is missing.' };
  } catch {
    return { ok: false, message: 'Can’t reach the worker. Check the URL and ALLOWED_ORIGINS.' };
  }
}

/** Ask the assistant. Falls back to the on-device parser when no endpoint is set. */
export async function askAssistant(endpoint: string, messages: ChatMsg[], ctx: ReturnType<typeof aiContext>): Promise<AiResult> {
  if (!endpoint) return { ...localParse(messages[messages.length - 1]?.content ?? '', ctx), offline: true };
  const r = await fetch(`${endpoint.replace(/\/$/, '')}/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: messages.slice(-8), context: ctx }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Assistant error (${r.status})`);
  return j as AiResult;
}

/** Names → ids. Unknown category names come back in `newCategories` for the caller to create. */
export function toDrafts(result: AiResult, categories: Category[], cards: Card[]) {
  const cat = (n: string | null | undefined) => (n ? categories.find((c) => c.name.toLowerCase() === n.toLowerCase()) : undefined);
  const card = (n: string | null | undefined) => (n && n !== 'cash' ? cards.find((c) => c.name.toLowerCase() === n.toLowerCase()) : undefined);
  return result.transactions.map((t) => {
    const c = cat(t.category);
    const draft: Draft = {
      type: t.type,
      amount: t.amount,
      merchant: t.title || (t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : c?.name ?? 'Expense'),
      categoryId: t.type === 'expense' ? c?.id ?? null : null,
      cardId: card(t.account)?.id ?? null,
      toCardId: t.type === 'transfer' ? card(t.toAccount)?.id ?? null : null,
      date: t.date,
      note: t.note ?? '',
      recurring: t.recurring,
    };
    return { draft, newCategory: t.type === 'expense' && !c ? t.newCategory ?? null : null };
  });
}

/* ------------------------------------------------------------------ */
/*  Offline fallback: simple rules, English only. Used until the AI     */
/*  worker URL is set, so voice entry still works for plain sentences.  */
/* ------------------------------------------------------------------ */

const NUM_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30,
  forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const CAT_HINTS: [RegExp, string[]][] = [
  [/lunch|dinner|breakfast|food|coffee|cafe|restaurant|mcd|kfc|subway|starbucks|nasi|mamak|meal|drink|juice|tea/, ['food', 'drink', 'beverage', 'meal']],
  [/grocer|supermarket|lotus|aeon|jaya|mydin|market/, ['grocer']],
  [/grab|taxi|indrive|uber|bus|train|lrt|mrt|petrol|fuel|parking|toll|shell|petronas/, ['transport', 'fuel']],
  [/shopee|lazada|shopping|clothes|uniqlo|amazon/, ['shopping']],
  [/bill|electric|water|internet|unifi|phone|rent|utility/, ['bill', 'utilit', 'rent']],
  [/movie|cinema|netflix|spotify|game|concert/, ['entertain', 'subscription']],
  [/doctor|clinic|pharmacy|medicine|hospital|guardian|watsons/, ['health']],
  [/flight|hotel|agoda|airbnb|trip|travel/, ['travel']],
];

function wordsToNumber(s: string) {
  const m = s.match(/\b((?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and|[\s-])+)\b/);
  if (!m) return null;
  let total = 0, cur = 0, any = false;
  for (const w of m[1].split(/[\s-]+/)) {
    if (w in NUM_WORDS) { cur += NUM_WORDS[w]; any = true; }
    else if (w === 'hundred') { cur = (cur || 1) * 100; any = true; }
    else if (w === 'thousand') { total += (cur || 1) * 1000; cur = 0; any = true; }
  }
  return any ? total + cur : null;
}

export function localParse(text: string, ctx: ReturnType<typeof aiContext>): AiResult {
  const s = text.toLowerCase().trim();
  if (!s) return { transactions: [], question: null, reply: 'I didn’t hear anything.' };

  const num = s.match(/(\d+(?:[.,]\d{1,2})?)\s*(k\b)?/);
  let amount = num ? Number(num[1].replace(',', '.')) * (num[2] ? 1000 : 1) : wordsToNumber(s);
  if (amount !== null && !(amount > 0)) amount = null;

  let date = ctx.today;
  if (/\byesterday\b/.test(s)) date = addDays(ctx.today, -1);
  else if (/day before yesterday/.test(s)) date = addDays(ctx.today, -2);
  else {
    const ago = s.match(/(\d+|two|three|four|five|six)\s+days?\s+ago/);
    if (ago) date = addDays(ctx.today, -(Number(ago[1]) || NUM_WORDS[ago[1]] || 0));
    const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b(last |on )?${d}\\b`).test(s));
    if (wd >= 0) {
      const t = parseISODate(ctx.today);
      let back = (t.getDay() - wd + 7) % 7;
      if (back === 0) back = 7;
      t.setDate(t.getDate() - back);
      date = toISODate(t);
    }
  }

  const type: AiTx['type'] = /\b(transfer|moved?|top(?:ped)? ?up)\b/.test(s) ? 'transfer'
    : /\b(salary|received|got paid|income|refund|earned|allowance)\b/.test(s) ? 'income' : 'expense';

  const acctOf = (frag: string) => ctx.accounts.find((a) => frag.includes(a.toLowerCase())) ?? (/\bcash\b/.test(frag) ? 'cash' : null);
  let account = acctOf(s), toAccount: string | null = null;
  if (type === 'transfer') {
    const from = s.match(/from ([a-z0-9 &'-]+?)(?: to | into |$)/), to = s.match(/(?:to|into) ([a-z0-9 &'-]+)$/);
    account = from ? acctOf(from[1]) : account;
    toAccount = to ? acctOf(to[1]) : null;
  }

  let category: string | null = null;
  if (type === 'expense') {
    // ignore account names ("Travel Rewards" is a card, not the Travel category)
    const bare = ctx.accounts.reduce((acc, a) => acc.split(a.toLowerCase()).join(' '), s);
    category = ctx.categories.find((c) => new RegExp(`\\b${c.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(bare)) ?? null;
    if (!category) {
      for (const [re, keys] of CAT_HINTS) {
        if (!re.test(bare)) continue;
        category = ctx.categories.find((c) => keys.some((k) => c.toLowerCase().includes(k))) ?? null;
        if (category) break;
      }
    }
  }

  const titleMatch = s.match(/\b(?:for|at|on)\s+([a-z][a-z' ]{1,30}?)(?=\s+(?:on|with|using|via|by|for|yesterday|today|last|\d)|$)/);
  let title = titleMatch?.[1]?.trim() ?? '';
  if (ctx.accounts.some((a) => a.toLowerCase() === title)) title = '';
  title = title.replace(/\b\w/g, (c) => c.toUpperCase());

  const recurring = /\b(every month|monthly|each month|subscription)\b/.test(s);

  if (amount === null) return { transactions: [], question: 'How much was it?', reply: 'How much was it?' };
  const tx: AiTx = { type, amount: Math.round(amount * 100) / 100, date, title, category, account, toAccount, recurring };
  const when = date === ctx.today ? 'today' : date === addDays(ctx.today, -1) ? 'yesterday' : parseISODate(date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  return { transactions: [tx], question: null, reply: `${type === 'income' ? 'Income' : type === 'transfer' ? 'Transfer' : 'Expense'} of ${tx.amount.toFixed(2)} ${when}${category ? `, ${category}` : ''}${account && account !== 'cash' ? ` on ${account}` : ''}.` };
}

export type { Transaction };
