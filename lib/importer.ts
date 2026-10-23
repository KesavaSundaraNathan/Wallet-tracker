'use client';

import type { Card, Category, Transaction } from './types';
import { toISODate } from './dates';

/** The standardised format every import is mapped onto. */
export const STANDARD_FIELDS = [
  { key: 'date', label: 'Date', required: true, hints: ['date', 'period', 'transaction date', 'posted', 'posting date', 'day'] },
  { key: 'merchant', label: 'Merchant / description', required: false, hints: ['merchant', 'description', 'payee', 'name', 'details', 'narration', 'note'] },
  { key: 'amount', label: 'Amount', required: true, hints: ['amount', 'value', 'debit', 'total', 'sum'] },
  { key: 'category', label: 'Category of expense', required: false, hints: ['category', 'type of expense', 'tag', 'group'] },
  { key: 'payment_mode', label: 'Mode of payment', required: false, hints: ['payment', 'mode', 'card', 'account', 'method', 'source'] },
  { key: 'type', label: 'Type (expense / income)', required: false, hints: ['income/expense', 'type', 'direction', 'dr/cr', 'credit/debit', 'kind'] },
  { key: 'note', label: 'Note', required: false, hints: ['memo', 'remarks', 'comment', 'subcategory'] },
  { key: 'recurring', label: 'Recurring (yes / no)', required: false, hints: ['recurring', 'repeat', 'subscription'] },
] as const;

export type FieldKey = (typeof STANDARD_FIELDS)[number]['key'];
export type Mapping = Partial<Record<FieldKey, string>>;
export type DateOrder = 'YMD' | 'DMY' | 'MDY';

export interface ParsedFile { name: string; headers: string[]; rows: Record<string, string>[] }

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv' || ext === 'txt') {
    const Papa = (await import('papaparse')).default;
    const text = await file.text();
    const res = Papa.parse<Record<string, string>>(text.trim(), { header: true, skipEmptyLines: true, transformHeader: (h) => h.trim() });
    return { name: file.name, headers: res.meta.fields ?? [], rows: res.data };
  }
  if (ext === 'xlsx') {
    const readXlsxFile = (await import('read-excel-file')).default;
    const sheet = await readXlsxFile(file); // first sheet → rows of cells
    if (sheet.length < 2) return { name: file.name, headers: [], rows: [] };
    const cell = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v === null || v === undefined ? '' : String(v).trim());
    const seen = new Map<string, number>();
    const headers = sheet[0].map((h) => {
      const name = cell(h); if (!name) return '';
      const n = (seen.get(name) ?? 0) + 1; seen.set(name, n);
      return n > 1 ? `${name} (${n})` : name;   // duplicate headers stay addressable
    });
    const rows = sheet.slice(1)
      .filter((r) => r.some((c) => cell(c) !== ''))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, cell(r[i])])));
    return { name: file.name, headers: headers.filter(Boolean), rows };
  }
  if (ext === 'xls') throw new Error('Old .xls files aren’t supported. Re-save it as .xlsx or .csv.');
  throw new Error('Unsupported file. Use .csv or .xlsx');
}

export function guessMapping(headers: string[], rows: Record<string, string>[] = []): Mapping {
  const m: Mapping = {};
  const used = new Set<string>();
  // ignore columns that are empty in (nearly) every row, e.g. an unused "Description"
  const filled = (h: string) => !rows.length || rows.filter((r) => (r[h] ?? '') !== '').length / rows.length > 0.5;
  headers = headers.filter(filled);
  for (const f of STANDARD_FIELDS) {
    const hit =
      headers.find((h) => !used.has(h) && h.toLowerCase().replace(/[_-]/g, ' ') === f.key.replace('_', ' ')) ??
      headers.find((h) => !used.has(h) && f.hints.some((x) => h.toLowerCase().includes(x)));
    if (hit) { m[f.key] = hit; used.add(hit); }
  }
  return m;
}

export function parseDate(raw: string, order: DateOrder): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (iso) return toISODate(new Date(+iso[1], +iso[2] - 1, +iso[3]));
  const parts = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (parts) {
    let [a, b, y] = [+parts[1], +parts[2], +parts[3]];
    if (y < 100) y += 2000;
    const [d, mo] = order === 'MDY' ? [b, a] : [a, b];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    return toISODate(new Date(y, mo - 1, d));
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : toISODate(new Date(t));
}

export const parseAmount = (raw: string) => {
  const neg = /^\s*\(.*\)\s*$/.test(raw) || raw.trim().startsWith('-');
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? (neg ? -n : n) : NaN;
};

export interface NormalizeResult {
  valid: Omit<Transaction, 'id'>[];
  newCategories: string[];
  newModes: string[];
  errors: { row: number; reason: string }[];
}

export function normalize(
  rows: Record<string, string>[],
  mapping: Mapping,
  opts: { dateOrder: DateOrder; cards: Card[]; categories: Category[]; fallbackCardId: string | null; createModes?: boolean },
): NormalizeResult {
  const out: NormalizeResult = { valid: [], newCategories: [], newModes: [], errors: [] };
  const catByName = new Map(opts.categories.map((c) => [c.name.toLowerCase(), c.id]));
  const get = (r: Record<string, string>, k: FieldKey) => (mapping[k] ? String(r[mapping[k]!] ?? '').trim() : '');
  // No type column but the file uses signed amounts (bank style): negative = expense, positive = income.
  const signed = !mapping.type && rows.some((r) => parseAmount(get(r, 'amount')) < 0);

  rows.forEach((r, i) => {
    const date = parseDate(get(r, 'date'), opts.dateOrder);
    const amountRaw = parseAmount(get(r, 'amount'));
    const merchant = get(r, 'merchant');
    if (!date) return out.errors.push({ row: i + 2, reason: 'Unreadable date' });
    if (!Number.isFinite(amountRaw) || amountRaw === 0) return out.errors.push({ row: i + 2, reason: 'Missing amount' });

    const typeRaw = get(r, 'type').toLowerCase();
    // moving money between your own accounts is neither income nor spending
    const isTransfer = /transfer/.test(typeRaw);
    // apps that log both legs: keep the outgoing one, skip its mirror
    if (isTransfer && /in\b|-in|_in/.test(typeRaw) && rows.some((o) => /transfer.*out/.test(get(o, 'type').toLowerCase()))) {
      return out.errors.push({ row: i + 2, reason: 'Incoming leg of a transfer' });
    }
    const type: Transaction['type'] = isTransfer ? 'transfer' : signed
      ? (amountRaw > 0 ? 'income' : 'expense')
      : /^(income|credit|deposit|cr\b|in\b)/.test(typeRaw) ? 'income' : 'expense';

    let categoryId: string | null = null;
    const catName = splitEmoji(get(r, 'category')).name;
    if (catName && type === 'expense') {
      const key = catName.toLowerCase();
      if (catByName.has(key)) categoryId = catByName.get(key)!;
      else {
        if (!out.newCategories.includes(get(r, 'category'))) out.newCategories.push(get(r, 'category'));
        categoryId = `__new:${get(r, 'category')}`; // resolved to a real id when committed
      }
    }

    const resolve = (raw: string): string | null => {
      const v = raw.trim().toLowerCase();
      const card = v ? opts.cards.find((c) => c.name.toLowerCase() === v || (c.last4 && v.includes(c.last4)) || v.includes(c.name.toLowerCase())) : undefined;
      if (card) return card.id;
      if (v && v !== 'cash' && opts.createModes) {
        if (!out.newModes.includes(raw.trim())) out.newModes.push(raw.trim());
        return `__mode:${raw.trim()}`;
      }
      return opts.fallbackCardId;
    };
    const cardId = resolve(get(r, 'payment_mode'));
    // transfers: the destination account sits in the category column (Money Manager style)
    const toCardId = type === 'transfer' && mapping.payment_mode ? resolve(get(r, 'category')) : null;

    out.valid.push({
      type,
      amount: Math.abs(amountRaw),
      merchant: merchant || 'Imported',
      date,
      categoryId,
      cardId,
      toCardId,
      note: get(r, 'note') || undefined,
      recurring: /^(y|yes|true|1|monthly)$/i.test(get(r, 'recurring')) || undefined,
    });
  });
  return out;
}

/** "🍜 Food" → { emoji: '🍜', name: 'Food' } */
export function splitEmoji(raw: string): { emoji: string; name: string } {
  const s = raw.trim();
  const m = s.match(/^((?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\u200d|\ufe0f)+)\s*(.*)$/u);
  return m && m[2] ? { emoji: m[1], name: m[2].trim() } : { emoji: '', name: s };
}

export const TEMPLATE_CSV =
  'date,merchant,amount,category,payment_mode,type,note,recurring\n' +
  '2026-10-01,Salary,7800.00,,,income,October pay,yes\n' +
  '2026-10-03,Netflix,54.90,Entertainment,Everyday,expense,,yes\n' +
  '2026-10-04,Jaya Grocer,132.40,Groceries,Everyday,expense,Weekly shop,no\n';
