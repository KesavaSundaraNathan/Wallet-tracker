'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useRef, useState } from 'react';
import { Download, FileSpreadsheet, Sparkles, Upload } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useMoney } from '@/lib/format';
import { STANDARD_FIELDS, TEMPLATE_CSV, guessMapping, normalize, parseFile, splitEmoji, type DateOrder, type Mapping, type ParsedFile } from '@/lib/importer';
import { buildSampleData } from '@/lib/sample';
import { easeOut } from '@/lib/motion';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';

const PALETTE = ['#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FF2D55', '#5AC8FA', '#5856D6', '#FFCC00', '#30B0C7', '#A2845E'];

/** Upload → map columns onto the standard format → preview → commit. */
export function ImportPanel() {
  const { cards, categories, addCategory, addCard, importTransactions, showToast, loadData } = useStore();
  const money = useMoney();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [dateOrder, setDateOrder] = useState<DateOrder>('DMY');
  const [fallbackCard, setFallbackCard] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [createModes, setCreateModes] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [guess, setGuess] = useState<Mapping>({});

  const onFile = async (f?: File | null) => {
    if (!f) return;
    setError(null);
    try {
      const parsed = await parseFile(f);
      if (!parsed.rows.length) throw new Error('That file has no rows.');
      setFile(parsed);
      const g = guessMapping(parsed.headers, parsed.rows);
      setGuess(g); setShowAll(false);
      // by default only the essentials come across; the rest is filled in by hand
      setMapping({ date: g.date, amount: g.amount, type: g.type });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const result = useMemo(
    () => (file ? normalize(file.rows, mapping, { dateOrder, cards, categories, fallbackCardId: fallbackCard || null, createModes }) : null),
    [file, mapping, dateOrder, cards, categories, fallbackCard, createModes],
  );
  const missing = STANDARD_FIELDS.filter((f) => f.required && !mapping[f.key]);

  const commit = () => {
    if (!result) return;
    const ids = new Map<string, string>();
    result.newCategories.forEach((name, i) => {
      ids.set(name, addCategory({ name: splitEmoji(name).name, emoji: splitEmoji(name).emoji || '🏷️', color: PALETTE[(categories.length + i) % PALETTE.length] }).id);
    });
    const modeIds = new Map<string, string>();
    result.newModes.forEach((name, i) => {
      const lower = name.toLowerCase();
      const network = lower.includes('amex') || lower.includes('american') ? 'amex' : lower.includes('master') ? 'mastercard' : 'visa';
      const finish = network === 'amex' ? 'platinum' : network === 'mastercard' ? 'gold' : 'midnight';
      modeIds.set(name, addCard({ name, network, finish, nameAlign: 'left', holder: '', last4: '', expiry: '' }).id);
    });
    const rows = result.valid.map((t) => ({
      ...t,
      cardId: t.cardId?.startsWith('__mode:') ? modeIds.get(t.cardId.slice(7)) ?? null : t.cardId,
      toCardId: t.toCardId?.startsWith('__mode:') ? modeIds.get(t.toCardId.slice(7)) ?? null : t.toCardId,
      categoryId: t.categoryId?.startsWith('__new:') ? ids.get(t.categoryId.slice(6)) ?? null : t.categoryId,
    }));
    const n = importTransactions(rows);
    showToast({ message: `Imported ${n} transactions` });
    setFile(null);
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'wallet-import-template.csv' }).click();
    URL.revokeObjectURL(url);
  };

  const loadSample = () => {
    const data = buildSampleData(cards);
    loadData({ cards: data.cards, transactions: [...useStore.getState().transactions, ...data.transactions], budgets: data.budgets });
    showToast({ message: `Loaded ${data.transactions.length} sample transactions` });
  };

  return (
    <div className="panel p-4">
      <AnimatePresence mode="wait" initial={false}>
        {!file ? (
          <motion.div key="drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: easeOut }}>
            <button
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); onFile(e.dataTransfer.files[0]); }}
              className={`flex w-full flex-col items-center gap-2 rounded-[16px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors duration-150 ${dragging ? 'border-accent bg-accent/5' : 'border-sep/25 hover:bg-fill/5'}`}
            >
              <span className="grid size-11 place-items-center rounded-full bg-accent/10 text-accent"><Upload size={20} /></span>
              <span className="text-headline">Drop a CSV or Excel file</span>
              <span className="text-footnote text-label2">or click to choose · .csv, .xlsx</span>
            </button>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.txt" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            {error && <p className="mt-3 text-footnote text-bad">{error}</p>}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="btn-secondary" onClick={downloadTemplate}><Download size={14} /> Standard format template</button>
              <button className="btn-plain" onClick={loadSample}><Sparkles size={14} /> Load sample data</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="map" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.24, ease: easeOut }} className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[10px] bg-ok/15 text-ok"><FileSpreadsheet size={18} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-headline">{file.name}</div>
                <div className="text-footnote text-label2">{file.rows.length} rows · {file.headers.length} columns</div>
              </div>
              <button className="btn-secondary" onClick={() => setFile(null)}>Choose another</button>
            </div>

            <div>
              <h4 className="mb-2 text-footnote font-medium text-label2">Map your columns to the standard format</h4>
              <div className="divide-y divide-sep/10 overflow-hidden rounded-[14px] bg-fill/[0.06]">
                {STANDARD_FIELDS.filter((f) => showAll || ['date', 'amount', 'type'].includes(f.key)).map((f) => (
                  <div key={f.key} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-callout">{f.label}{f.required && <span className="text-bad"> *</span>}</span>
                    <Select compact className="w-[220px]" value={mapping[f.key] ?? ''} placeholder="— Not in file —"
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v || undefined }))}
                      options={[{ value: '', label: '— Not in file —' }, ...file.headers.map((h) => ({ value: h, label: h }))]} />
                  </div>
                ))}
              </div>
              {!showAll && (
                <button className="btn-plain mt-2 px-1" onClick={() => { setShowAll(true); setMapping((m) => ({ ...guess, ...m })); }}>
                  Also import merchant, category, card… (optional)
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              <div>
                <div className="mb-1.5 text-footnote font-medium text-label2">Date order</div>
                <Segmented<DateOrder> size="sm" value={dateOrder} onChange={setDateOrder} options={[{ value: 'DMY', label: 'DD/MM/YYYY' }, { value: 'MDY', label: 'MM/DD/YYYY' }, { value: 'YMD', label: 'YYYY-MM-DD' }]} />
              </div>
              {mapping.payment_mode && (
                <label className="flex items-center gap-2 pb-2 text-callout">
                  <input type="checkbox" checked={createModes} onChange={(e) => setCreateModes(e.target.checked)} /> Create cards for new payment modes
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-footnote font-medium text-label2">Payment mode for imported rows</span>
                <Select compact className="w-[200px]" value={fallbackCard} onChange={setFallbackCard}
                  options={[{ value: '', label: 'Cash / other' }, ...cards.map((c) => ({ value: c.id, label: c.name }))]} />
              </label>
            </div>

            {missing.length > 0 ? (
              <p className="rounded-[12px] bg-warn/10 px-3 py-2 text-footnote text-warn">Map {missing.map((m) => m.label).join(', ')} to continue.</p>
            ) : result && (
              <>
                <div className="overflow-x-auto rounded-[14px] bg-fill/[0.06]">
                  <table className="w-full text-left text-footnote">
                    <thead className="text-label2"><tr>{['Date', 'Merchant', 'Category', 'Mode', 'Amount'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-sep/10">
                      {result.valid.slice(0, 5).map((t, i) => (
                        <tr key={i}>
                          <td className="tabular px-3 py-2">{t.date}</td>
                          <td className="px-3 py-2">{t.merchant}</td>
                          <td className="px-3 py-2 text-label2">{t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : t.categoryId?.startsWith('__new:') ? `${splitEmoji(t.categoryId.slice(6)).name} (new)` : categories.find((c) => c.id === t.categoryId)?.name ?? '—'}</td>
                          <td className="px-3 py-2 text-label2">{t.cardId?.startsWith('__mode:') ? `${t.cardId.slice(7)} (new)` : cards.find((c) => c.id === t.cardId)?.name ?? 'Cash / other'}</td>
                          <td className={`tabular px-3 py-2 text-right ${t.type === 'income' ? 'text-ok' : ''}`}>{money(t.type === 'expense' ? -t.amount : t.amount, { sign: t.type === 'income' })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-footnote text-label2">
                    {result.valid.length} ready
                    {result.errors.length > 0 && <span className="text-bad"> · {result.errors.length} skipped (e.g. row {result.errors[0].row}: {result.errors[0].reason})</span>}
                    {result.newModes.length > 0 && <> · {createModes ? 'creates' : 'would create'} {result.newModes.length} {result.newModes.length === 1 ? 'card' : 'cards'} ({result.newModes.join(', ')})</>}
                    {result.newCategories.length > 0 && <> · creates {result.newCategories.length} new {result.newCategories.length === 1 ? 'category' : 'categories'}</>}
                  </p>
                  <button className="btn-primary" disabled={!result.valid.length} onClick={commit}>Import {result.valid.length} transactions</button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
