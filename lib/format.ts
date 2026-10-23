import { useStore } from './store';

export const CURRENCIES = ['MYR', 'USD', 'EUR', 'GBP', 'SGD', 'INR', 'AUD', 'JPY'] as const;

const cache = new Map<string, Intl.NumberFormat>();
export function formatMoney(value: number, currency: string, opts: { compact?: boolean; sign?: boolean } = {}) {
  const key = `${currency}-${opts.compact}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      notation: opts.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts.compact ? 1 : 2,
      minimumFractionDigits: opts.compact ? 0 : 2,
    });
    cache.set(key, f);
  }
  const s = f.format(Math.abs(value));
  if (!opts.sign) return value < 0 ? `-${s}` : s;
  return value < 0 ? `−${s}` : `+${s}`;
}

/** Hook: formatter bound to the user's currency. */
export function useMoney() {
  const currency = useStore((s) => s.currency);
  return (v: number, o?: { compact?: boolean; sign?: boolean }) => formatMoney(v, currency, o);
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
