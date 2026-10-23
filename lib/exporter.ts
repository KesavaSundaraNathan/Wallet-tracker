'use client';

import type { Card, Category, Transaction } from './types';
import { addDays, parseISODate, today } from './dates';
import { byCard, byCategory, expensesOf, incomeOf, sortByDateDesc, sum } from './selectors';

interface Ctx { txs: Transaction[]; cards: Card[]; categories: Category[]; currency: string; from: string; to: string }

const catName = (c: Ctx, id: string | null) => c.categories.find((x) => x.id === id)?.name ?? (id ? 'Uncategorised' : '—');
const cardName = (c: Ctx, id: string | null) => {
  const k = c.cards.find((x) => x.id === id);
  return k ? `${k.name} (•• ${k.last4})` : id ? 'Removed card' : 'Cash / other';
};
const fmtDate = (iso: string) => parseISODate(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** jsPDF core fonts are WinAnsi — fall back to the ISO code for symbols outside it (₹, ¥ …). */
function pdfMoney(v: number, currency: string) {
  let s = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).format(v);
  s = s.replace(/[  ]/g, ' ');
  if (/[^\x00-\xff€]/.test(s)) s = new Intl.NumberFormat('en', { style: 'currency', currency, currencyDisplay: 'code' }).format(v).replace(/[  ]/g, ' ');
  return s;
}
const latin = (s: string) => s.replace(/[^\x00-\xff’‘“”–—•€]/g, '').trim();

/* ================================================================== */
/*  Type A — Statement                                                */
/* ================================================================== */

export function exportStatementCSV(c: Ctx) {
  const rows = sortByDateDesc(c.txs);
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ['Date', 'Merchant', 'Category of expense', 'Mode of payment', 'Type', 'Amount', 'Note'].join(','),
    ...rows.map((t) =>
      [t.date, t.merchant, t.type === 'income' ? 'Income' : t.type === 'transfer' ? `Transfer to ${cardName(c, t.toCardId ?? null)}` : catName(c, t.categoryId), cardName(c, t.cardId), t.type, (t.type === 'expense' ? -t.amount : t.amount).toFixed(2), t.note ?? '']
        .map(esc).join(','),
    ),
  ];
  download(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' }), `statement_${c.from}_${c.to}.csv`);
}

export async function exportStatementPDF(c: Ctx) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rows = sortByDateDesc(c.txs);
  const spent = sum(expensesOf(rows)), income = sum(incomeOf(rows));

  doc.setFont('helvetica', 'bold').setFontSize(20).setTextColor(29, 29, 31).text('Statement', 16, 22);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(110, 110, 115)
    .text(`${fmtDate(c.from)} – ${fmtDate(c.to)}   ·   ${rows.length} transactions`, 16, 29);
  doc.setFontSize(10).setTextColor(29, 29, 31)
    .text(`Spent ${pdfMoney(spent, c.currency)}    Income ${pdfMoney(income, c.currency)}    Net ${pdfMoney(income - spent, c.currency)}`, 16, 37);

  autoTable(doc, {
    startY: 44,
    head: [['Date', 'Category of expense', 'Mode of payment', 'Merchant', 'Amount']],
    body: rows.map((t) => [
      fmtDate(t.date),
      t.type === 'income' ? 'Income' : t.type === 'transfer' ? 'Transfer' : latin(catName(c, t.categoryId)),
      latin(cardName(c, t.cardId)),
      latin(t.merchant) + (t.recurring ? '  (recurring)' : ''),
      pdfMoney(t.type === 'expense' ? -t.amount : t.amount, c.currency),
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.4, textColor: [29, 29, 31], lineColor: [230, 230, 235], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 247], textColor: [110, 110, 115], fontStyle: 'bold' },
    columnStyles: { 4: { halign: 'right' } },
    alternateRowStyles: { fillColor: [252, 252, 253] },
    margin: { left: 16, right: 16 },
  });
  doc.save(`statement_${c.from}_${c.to}.pdf`);
}

/* ================================================================== */
/*  Type B — Visual report                                            */
/* ================================================================== */

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export async function exportVisualPDF(c: Ctx) {
  const { jsPDF } = await import('jspdf');
  const autoTable = (await import('jspdf-autotable')).default;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 16;
  const ex = expensesOf(c.txs), inc = incomeOf(c.txs);
  const spent = sum(ex), income = sum(inc);
  const days = Math.max(1, Math.round((parseISODate(c.to).getTime() - parseISODate(c.from).getTime()) / 864e5) + 1);
  const cats = byCategory(c.txs, c.categories);
  const modes = byCard(c.txs, c.cards);

  /* header */
  doc.setFillColor(29, 29, 31).roundedRect(M, 14, W - 2 * M, 30, 5, 5, 'F');
  doc.setTextColor(255, 255, 255).setFont('helvetica', 'bold').setFontSize(20).text('Spending Report', M + 8, 28);
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(200, 200, 205)
    .text(`${fmtDate(c.from)} – ${fmtDate(c.to)}  ·  ${days} days  ·  generated ${fmtDate(today())}`, M + 8, 36);

  /* KPI tiles */
  const kpis: [string, string][] = [
    ['Total spent', pdfMoney(spent, c.currency)],
    ['Income', pdfMoney(income, c.currency)],
    ['Net', pdfMoney(income - spent, c.currency)],
    ['Daily average', pdfMoney(spent / days, c.currency)],
  ];
  const tw = (W - 2 * M - 3 * 4) / 4;
  kpis.forEach(([label, value], i) => {
    const x = M + i * (tw + 4);
    doc.setFillColor(245, 245, 247).roundedRect(x, 50, tw, 22, 3.5, 3.5, 'F');
    doc.setFontSize(8).setTextColor(110, 110, 115).text(label.toUpperCase(), x + 4, 57);
    doc.setFont('helvetica', 'bold').setFontSize(12.5).setTextColor(29, 29, 31).text(value, x + 4, 66);
    doc.setFont('helvetica', 'normal');
  });

  /* donut — where it went */
  section(doc, 'Where it went', M, 84);
  const cx = M + 32, cy = 122, R = 26, r = 16;
  let a = -Math.PI / 2;
  const total = cats.reduce((s, x) => s + x.value, 0) || 1;
  for (const s of cats) {
    const sweep = (s.value / total) * Math.PI * 2;
    wedge(doc, cx, cy, R, r, a + 0.012, a + sweep - 0.012, rgb(s.color));
    a += sweep;
  }
  if (!cats.length) { doc.setDrawColor(230, 230, 235).setLineWidth(10).circle(cx, cy, (R + r) / 2, 'S'); }
  doc.setFontSize(7.5).setTextColor(110, 110, 115).text('SPENT', cx, cy - 2, { align: 'center' });
  doc.setFont('helvetica', 'bold').setFontSize(10).setTextColor(29, 29, 31).text(pdfMoney(spent, c.currency), cx, cy + 4, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  // legend with meters
  const lx = M + 72, lw = W - M - lx;
  cats.slice(0, 8).forEach((s, i) => {
    const y = 96 + i * 7.4;
    doc.setFillColor(...rgb(s.color)).circle(lx + 1.5, y - 1.2, 1.5, 'F');
    doc.setFontSize(9).setTextColor(29, 29, 31).text(latin(s.label), lx + 5, y);
    doc.setTextColor(110, 110, 115).text(`${Math.round((s.value / total) * 100)}%`, lx + 52, y, { align: 'right' });
    doc.setFillColor(238, 238, 241).roundedRect(lx + 56, y - 2.6, lw - 86, 2.6, 1.3, 1.3, 'F');
    doc.setFillColor(...rgb(s.color)).roundedRect(lx + 56, y - 2.6, Math.max(1.5, (lw - 86) * (s.value / cats[0].value)), 2.6, 1.3, 1.3, 'F');
    doc.setTextColor(29, 29, 31).text(pdfMoney(s.value, c.currency), W - M, y, { align: 'right' });
  });

  /* spending over time — bars + cumulative line */
  section(doc, 'Spending over time', M, 164);
  const bucket = days <= 45 ? 1 : days <= 180 ? 7 : 30;
  const buckets: { label: string; value: number }[] = [];
  for (let d = c.from; d <= c.to; d = addDays(d, bucket)) {
    const end = addDays(d, bucket - 1);
    const v = sum(ex.filter((t) => t.date >= d && t.date <= end));
    const dt = parseISODate(d);
    buckets.push({ label: bucket === 30 ? dt.toLocaleDateString('en', { month: 'short' }) : `${dt.getDate()}/${dt.getMonth() + 1}`, value: v });
  }
  const chart = { x: M, y: 172, w: W - 2 * M, h: 52 };
  const max = Math.max(1, ...buckets.map((b) => b.value));
  doc.setDrawColor(230, 230, 235).setLineWidth(0.2);
  for (let g = 0; g <= 3; g++) {
    const gy = chart.y + chart.h - (chart.h * g) / 3;
    doc.setLineDashPattern([0.8, 0.8], 0).line(chart.x, gy, chart.x + chart.w, gy);
    doc.setFontSize(6.5).setTextColor(160, 160, 166).text(pdfMoney((max * g) / 3, c.currency).replace(/\.\d+$/, ''), chart.x + chart.w, gy - 1, { align: 'right' });
  }
  doc.setLineDashPattern([], 0);
  const bw = chart.w / buckets.length;
  buckets.forEach((b, i) => {
    const h = (b.value / max) * chart.h;
    if (h > 0) doc.setFillColor(0, 113, 227).roundedRect(chart.x + i * bw + bw * 0.18, chart.y + chart.h - h, bw * 0.64, h, Math.min(1.2, bw * 0.3), Math.min(1.2, bw * 0.3), 'F');
    const every = Math.ceil(buckets.length / 12);
    if (i % every === 0) doc.setFontSize(6.5).setTextColor(110, 110, 115).text(b.label, chart.x + i * bw + bw / 2, chart.y + chart.h + 4, { align: 'center' });
  });
  // cumulative line on secondary scale
  let run = 0;
  const pts = buckets.map((b, i) => { run += b.value; return [chart.x + i * bw + bw / 2, run] as const; });
  const cmax = Math.max(1, run);
  doc.setDrawColor(255, 149, 0).setLineWidth(0.6);
  for (let i = 1; i < pts.length; i++) {
    doc.line(pts[i - 1][0], chart.y + chart.h - (pts[i - 1][1] / cmax) * chart.h, pts[i][0], chart.y + chart.h - (pts[i][1] / cmax) * chart.h);
  }
  const ly = chart.y + chart.h + 10;
  doc.setFillColor(0, 113, 227).roundedRect(chart.x, ly - 2.2, 2.6, 2.6, 0.6, 0.6, 'F');
  doc.setFontSize(7).setTextColor(110, 110, 115).text('Spent per ' + (bucket === 1 ? 'day' : bucket === 7 ? 'week' : 'month'), chart.x + 4, ly);
  doc.setDrawColor(255, 149, 0).setLineWidth(0.6).line(chart.x + 40, ly - 0.9, chart.x + 45, ly - 0.9);
  doc.text('Cumulative', chart.x + 47, ly);

  /* mode of payment */
  section(doc, 'By mode of payment', M, 246);
  modes.slice(0, 4).forEach((s, i) => {
    const y = 254 + i * 7;
    doc.setFontSize(9).setTextColor(29, 29, 31).text(latin(s.label), M, y);
    const bx = M + 48, bwid = W - 2 * M - 48 - 34;
    doc.setFillColor(238, 238, 241).roundedRect(bx, y - 2.8, bwid, 3, 1.5, 1.5, 'F');
    doc.setFillColor(...rgb(s.color)).roundedRect(bx, y - 2.8, Math.max(1.5, bwid * (s.value / (modes[0]?.value || 1))), 3, 1.5, 1.5, 'F');
    doc.text(pdfMoney(s.value, c.currency), W - M, y, { align: 'right' });
  });

  /* page 2 — top merchants & largest transactions */
  doc.addPage();
  section(doc, 'Top merchants', M, 20);
  const merch = new Map<string, { n: number; v: number }>();
  ex.forEach((t) => { const m = merch.get(t.merchant) ?? { n: 0, v: 0 }; m.n++; m.v += t.amount; merch.set(t.merchant, m); });
  const tableStyle = {
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: [29, 29, 31] as [number, number, number], lineColor: [230, 230, 235] as [number, number, number], lineWidth: 0.1 },
    headStyles: { fillColor: [245, 245, 247] as [number, number, number], textColor: [110, 110, 115] as [number, number, number], fontStyle: 'bold' as const },
    margin: { left: M, right: M },
  };
  autoTable(doc, {
    ...tableStyle, startY: 26,
    head: [['Merchant', 'Visits', 'Total', 'Share']],
    body: [...merch.entries()].sort((x, y) => y[1].v - x[1].v).slice(0, 12)
      .map(([m, s]) => [latin(m), String(s.n), pdfMoney(s.v, c.currency), `${Math.round((s.v / (spent || 1)) * 100)}%`]),
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const y2 = ((doc as any).lastAutoTable?.finalY ?? 120) + 14;
  section(doc, 'Largest transactions', M, y2);
  autoTable(doc, {
    ...tableStyle, startY: y2 + 6,
    head: [['Date', 'Merchant', 'Category', 'Mode of payment', 'Amount']],
    body: [...ex].sort((x, y) => y.amount - x.amount).slice(0, 10)
      .map((t) => [fmtDate(t.date), latin(t.merchant), latin(catName(c, t.categoryId)), latin(cardName(c, t.cardId)), pdfMoney(t.amount, c.currency)]),
    columnStyles: { 4: { halign: 'right' } },
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5).setTextColor(160, 160, 166).text(`Wallet · Spending report · ${p}/${pages}`, W / 2, 290, { align: 'center' });
  }
  doc.save(`spending-report_${c.from}_${c.to}.pdf`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function section(doc: any, title: string, x: number, y: number) {
  doc.setFont('helvetica', 'bold').setFontSize(12).setTextColor(29, 29, 31).text(title, x, y);
  doc.setFont('helvetica', 'normal');
}

/** Filled ring segment as a polygon (jsPDF has no arc fill). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wedge(doc: any, cx: number, cy: number, R: number, r: number, a0: number, a1: number, color: [number, number, number]) {
  if (a1 <= a0) return;
  const steps = Math.max(2, Math.ceil(((a1 - a0) * 180) / Math.PI / 3));
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
  for (let i = steps; i >= 0; i--) { const a = a0 + ((a1 - a0) * i) / steps; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  const deltas = pts.slice(1).map((p, i) => [p[0] - pts[i][0], p[1] - pts[i][1]]);
  doc.setFillColor(...color).lines(deltas, pts[0][0], pts[0][1], [1, 1], 'F', true);
}
