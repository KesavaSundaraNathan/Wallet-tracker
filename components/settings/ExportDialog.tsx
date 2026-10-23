'use client';

import { useMemo, useState } from 'react';
import { FileText, PieChart, Table2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Segmented } from '@/components/ui/Segmented';
import { Field } from '@/components/ui/Field';
import { useStore } from '@/lib/store';
import { addDays, addMonths, currentMonth, daysInMonth, today } from '@/lib/dates';
import { inRange } from '@/lib/selectors';
import { exportStatementCSV, exportStatementPDF, exportVisualPDF } from '@/lib/exporter';

type Kind = 'statement' | 'visual';

export function ExportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { transactions, cards, categories, currency, showToast } = useStore();
  const [kind, setKind] = useState<Kind>('statement');
  const [format, setFormat] = useState<'csv' | 'pdf'>('csv');
  const earliest = useMemo(() => transactions.reduce((m, t) => (t.date < m ? t.date : m), today()), [transactions]);
  const [from, setFrom] = useState(`${currentMonth()}-01`);
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);

  const presets: [string, () => [string, string]][] = [
    ['This month', () => [`${currentMonth()}-01`, today()]],
    ['Last month', () => { const m = addMonths(currentMonth(), -1); return [`${m}-01`, `${m}-${daysInMonth(m)}`]; }],
    ['Last 90 days', () => [addDays(today(), -89), today()]],
    ['Year to date', () => [`${today().slice(0, 4)}-01-01`, today()]],
    ['All time', () => [earliest, today()]],
  ];

  const scoped = inRange(transactions, from, to);
  const run = async () => {
    if (from > to) return;
    setBusy(true);
    const ctx = { txs: scoped, cards, categories, currency, from, to };
    try {
      if (kind === 'visual') await exportVisualPDF(ctx);
      else if (format === 'pdf') await exportStatementPDF(ctx);
      else exportStatementCSV(ctx);
      showToast({ message: 'Export ready' });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const Tile = ({ k, icon, title, desc }: { k: Kind; icon: React.ReactNode; title: string; desc: string }) => (
    <button
      onClick={() => setKind(k)}
      aria-pressed={kind === k}
      className={`pressable relative flex flex-col items-start gap-2 rounded-[16px] p-4 text-left ${kind === k ? 'bg-accent/[0.08]' : 'bg-fill/[0.08] hover:bg-fill/[0.12]'}`}
    >
      <span className={`pointer-events-none absolute inset-0 rounded-[16px] ring-accent transition-[box-shadow,opacity] duration-200 ease-out ${kind === k ? 'opacity-100 ring-2' : 'opacity-0 ring-0'}`} />
      <span className={`grid size-9 place-items-center rounded-[10px] ${kind === k ? 'bg-accent text-white' : 'bg-fill/15 text-label2'}`}>{icon}</span>
      <span className="text-headline">{title}</span>
      <span className="text-footnote text-label2">{desc}</span>
    </button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export data"
      footer={
        <>
          <span className="mr-auto text-footnote text-label2">{scoped.length} transactions in range</span>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy || !scoped.length || from > to} onClick={run}>
            {busy ? 'Preparing…' : kind === 'visual' ? 'Generate PDF' : `Export ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Tile k="statement" icon={<Table2 size={18} />} title="Statement" desc="Raw log: date, category of expense, mode of payment." />
          <Tile k="visual" icon={<PieChart size={18} />} title="Stats & visuals" desc="A formatted PDF report of your spending trends." />
        </div>

        {kind === 'statement' && (
          <Field label="Format">
            <Segmented value={format} onChange={setFormat} options={[{ value: 'csv', label: 'CSV' }, { value: 'pdf', label: 'PDF' }]} />
          </Field>
        )}

        <div>
          <div className="mb-1.5 text-footnote font-medium text-label2">Period</div>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1">
            {presets.map(([label, fn]) => {
              const [f, t] = fn();
              const active = f === from && t === to;
              return (
                <button key={label} onClick={() => { setFrom(f); setTo(t); }} className={`pressable shrink-0 rounded-full px-3 py-1 text-footnote font-medium ${active ? 'bg-label text-canvas' : 'bg-fill/[0.12] text-label'}`}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From"><input type="date" className="input" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label="To" error={from > to ? 'End date is before start date' : null}><input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></Field>
          </div>
        </div>
        {kind === 'visual' && (
          <p className="flex items-start gap-2 rounded-[12px] bg-fill/[0.08] px-3 py-2.5 text-footnote text-label2">
            <FileText size={15} className="mt-[2px] shrink-0" />
            Includes headline totals, category donut, spending over time with a cumulative line, mode-of-payment split, top merchants and largest transactions.
          </p>
        )}
      </div>
    </Modal>
  );
}
