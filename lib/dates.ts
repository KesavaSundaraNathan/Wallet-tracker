const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());
export const parseISODate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
/** "2026-10" */
export const monthKey = (date: string | Date) =>
  typeof date === 'string' ? date.slice(0, 7) : `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
export const currentMonth = () => monthKey(new Date());

export const addMonths = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKey(d);
};
export const daysInMonth = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};
export const monthLabel = (key: string, style: 'long' | 'short' = 'long') => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: style, year: style === 'long' ? 'numeric' : undefined });
};
export const addDays = (iso: string, delta: number) => {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + delta);
  return toISODate(d);
};

export const relativeDayLabel = (iso: string) => {
  const t = today();
  if (iso === t) return 'Today';
  if (iso === addDays(t, -1)) return 'Yesterday';
  const d = parseISODate(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: sameYear ? undefined : 'numeric' });
};
