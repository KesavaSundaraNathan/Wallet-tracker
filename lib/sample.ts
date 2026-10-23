import type { Card, Transaction } from './types';
import { addMonths, currentMonth, daysInMonth, today } from './dates';
import { uid } from './format';

/** Realistic demo data spanning the last 6 months, so charts have something to say. */
export function buildSampleData(existingCards: Card[]) {
  const demo: Card[] = [
    { id: uid(), name: 'Everyday', network: 'visa', finish: 'midnight', nameAlign: 'left', holder: 'K SUNDARANATHAN', last4: '4021', expiry: '08/29', createdAt: Date.now() },
    { id: uid(), name: 'Travel Rewards', network: 'amex', finish: 'platinum', nameAlign: 'left', holder: 'K SUNDARANATHAN', last4: '7997', expiry: '11/28', createdAt: Date.now() + 1 },
    { id: uid(), name: 'Gold', network: 'mastercard', finish: 'gold', nameAlign: 'left', holder: 'K SUNDARANATHAN', last4: '5530', expiry: '03/30', createdAt: Date.now() + 2 },
    { id: uid(), name: 'Online', network: 'visa', finish: 'aurora', nameAlign: 'right', holder: 'K SUNDARANATHAN', last4: '8812', expiry: '06/27', createdAt: Date.now() + 3 },
  ];
  // keep the user's cards; top up with demo cards (skipping networks+names already present)
  const cards: Card[] = [...existingCards, ...demo.filter((d) => !existingCards.some((c) => c.name === d.name))].slice(0, Math.max(4, existingCards.length));

  const merchants: [string, string, number, number][] = [
    // merchant, category, min, max
    ['Starbucks', 'food', 12, 24], ['Grab Food', 'food', 18, 55], ['Nasi Kandar Pelita', 'food', 9, 22],
    ['Jaya Grocer', 'groceries', 40, 180], ['Lotus’s', 'groceries', 30, 140],
    ['Grab', 'transport', 8, 35], ['Touch ’n Go', 'transport', 20, 50], ['Shell', 'transport', 60, 120],
    ['Uniqlo', 'shopping', 59, 249], ['Shopee', 'shopping', 15, 210], ['Apple Store', 'shopping', 99, 499],
    ['TNB Electricity', 'bills', 90, 210], ['Unifi', 'bills', 129, 129],
    ['GSC Cinemas', 'entertainment', 18, 60], ['Spotify', 'entertainment', 15.9, 15.9],
    ['Guardian', 'health', 12, 80], ['AirAsia', 'travel', 150, 620], ['Agoda', 'travel', 180, 720],
  ];
  const rand = (a: number, b: number) => Math.round((a + Math.random() * (b - a)) * 100) / 100;
  const t = today();
  const txs: Transaction[] = [];
  const end = currentMonth();

  for (let i = 5; i >= 0; i--) {
    const m = addMonths(end, -i);
    const dim = daysInMonth(m);
    const lastDay = i === 0 ? Number(t.slice(8, 10)) : dim;
    const count = Math.round(lastDay * 1.1);
    for (let k = 0; k < count; k++) {
      const [merchant, categoryId, a, b] = merchants[Math.floor(Math.random() * merchants.length)];
      const day = 1 + Math.floor(Math.random() * lastDay);
      txs.push({
        id: uid(), type: 'expense', merchant, categoryId, amount: rand(a, b),
        cardId: cards[Math.floor(Math.random() * cards.length)].id,
        date: `${m}-${String(day).padStart(2, '0')}`,
      });
    }
  }
  // recurring series, one occurrence per month, plus salary
  const series: [string, string, number, number][] = [['Netflix', 'entertainment', 54.9, 3], ['Rent', 'bills', 1800, 1], ['iCloud+', 'bills', 12.9, 12]];
  for (const [merchant, categoryId, amount, day] of series) {
    const seriesId = uid();
    for (let i = 5; i >= 0; i--) {
      const m = addMonths(end, -i);
      if (i === 0 && day > Number(t.slice(8, 10))) continue;
      txs.push({ id: uid(), type: 'expense', merchant, categoryId, amount, recurring: true, seriesId, cardId: cards[i % cards.length].id, date: `${m}-${String(day).padStart(2, '0')}` });
    }
  }
  const salaryId = uid();
  for (let i = 5; i >= 0; i--) {
    const m = addMonths(end, -i);
    txs.push({ id: uid(), type: 'income', merchant: 'Salary — Authenwrite Studio', categoryId: null, amount: 7800, recurring: true, seriesId: salaryId, cardId: null, date: `${m}-01` });
  }
  return {
    cards,
    transactions: txs,
    budgets: [
      { id: uid(), categoryId: 'food', limit: 900 },
      { id: uid(), categoryId: 'groceries', limit: 700 },
      { id: uid(), categoryId: 'transport', limit: 450 },
      { id: uid(), categoryId: 'shopping', limit: 800 },
      { id: uid(), categoryId: 'entertainment', limit: 250 },
    ],
  };
}
