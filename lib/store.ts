'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Budget, Card, Category, ChartType, StatsMode, Transaction } from './types';
import { addMonths, currentMonth, daysInMonth, monthKey } from './dates';
import { uid } from './format';
import { DEFAULT_AI_ENDPOINT } from './ai';

/* ------------------------------------------------------------------ */
/*  Shape                                                              */
/* ------------------------------------------------------------------ */

export interface Toast {
  id: string;
  message: string;
  actionLabel?: string;
  action?: () => void;
}

interface DataSlice {
  cards: Card[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  currency: string;
  profileName: string;
  /** Data-URL of the (downscaled) profile photo. */
  avatar: string | null;
  theme: 'system' | 'light' | 'dark';
  /** Cloudflare Worker URL for the AI assistant ('' = offline parser). Public, not a secret. */
  aiEndpoint: string;
  voiceReplies: boolean;
  /** Save voice transactions straight away instead of asking to confirm. */
  autoAdd: boolean;
  /** Month the log is "live" on. Rolls forward on the first launch of a new month. */
  activeMonth: string;
}

interface UISlice {
  /**
   * THE shared selection. Home (wallet), Stats (carousel) and Activity (filter)
   * all read and write this one id, so picking a card anywhere carries over.
   */
  selectedCardId: string | null;
  statsMode: StatsMode;
  chartType: ChartType;
  /** When true, Activity opens pre-filtered to selectedCardId. */
  activityFollowsCard: boolean;
  toast: Toast | null;
  hydrated: boolean;
}

interface Actions {
  // cards
  addCard: (c: Omit<Card, 'id' | 'createdAt'>) => Card;
  updateCard: (id: string, patch: Partial<Card>) => void;
  deleteCard: (id: string) => void;
  // transactions
  upsertTransaction: (t: Omit<Transaction, 'id'> & { id?: string }) => void;
  deleteTransaction: (id: string) => void;
  importTransactions: (rows: Omit<Transaction, 'id'>[]) => number;
  // categories & budgets
  addCategory: (c: Omit<Category, 'id'>) => Category;
  updateCategory: (id: string, patch: Partial<Category>) => void;
  deleteCategory: (id: string) => void;
  /** Returns false (and does nothing) if the category doesn't exist — the "category first" rule. */
  setBudget: (categoryId: string, limit: number) => boolean;
  deleteBudget: (id: string) => void;
  // ui
  selectCard: (id: string | null) => void;
  stepCard: (delta: number) => void;
  setStatsMode: (m: StatsMode) => void;
  setChartType: (t: ChartType) => void;
  setActivityFollowsCard: (v: boolean) => void;
  setCurrency: (c: string) => void;
  setProfileName: (n: string) => void;
  setAvatar: (a: string | null) => void;
  setTheme: (t: 'system' | 'light' | 'dark') => void;
  setAi: (p: Partial<Pick<DataSlice, 'aiEndpoint' | 'voiceReplies' | 'autoAdd'>>) => void;
  showToast: (t: Omit<Toast, 'id'>) => void;
  dismissToast: () => void;
  // lifecycle
  rollover: () => void;
  loadData: (d: Partial<DataSlice>) => void;
  resetAll: () => void;
}

export type State = DataSlice & UISlice & Actions;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Drink', emoji: '🍜', color: '#3AA676' },
  { id: 'groceries', name: 'Groceries', emoji: '🛒', color: '#22B8CF' },
  { id: 'transport', name: 'Transport', emoji: '🚇', color: '#7A5AF8' },
  { id: 'shopping', name: 'Shopping', emoji: '🛍️', color: '#2E5BEA' },
  { id: 'bills', name: 'Bills & Utilities', emoji: '💡', color: '#F4C542' },
  { id: 'entertainment', name: 'Entertainment', emoji: '🎬', color: '#F0582B' },
  { id: 'health', name: 'Health', emoji: '🩺', color: '#EE46BC' },
  { id: 'travel', name: 'Travel', emoji: '✈️', color: '#0BA5EC' },
];
const LEGACY_COLORS = ['#FF9500', '#34C759', '#007AFF', '#AF52DE', '#FFCC00', '#FF2D55', '#5AC8FA', '#5856D6'];

const emptyData = (): DataSlice => ({
  cards: [],
  transactions: [],
  categories: DEFAULT_CATEGORIES,
  budgets: [],
  currency: 'MYR',
  profileName: '',
  avatar: null,
  theme: 'system',
  aiEndpoint: DEFAULT_AI_ENDPOINT,
  voiceReplies: true,
  autoAdd: false,
  activeMonth: currentMonth(),
});

/* ------------------------------------------------------------------ */
/*  Store                                                              */
/* ------------------------------------------------------------------ */

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...emptyData(),
      selectedCardId: null,
      statsMode: 'card',
      chartType: 'pie',
      activityFollowsCard: false,
      toast: null,
      hydrated: false,

      /* ---------- cards ---------- */
      addCard: (c) => {
        const card: Card = { ...c, id: uid(), createdAt: Date.now() };
        set((s) => ({ cards: [...s.cards, card] }));
        return card;
      },
      updateCard: (id, patch) => set((s) => ({ cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCard: (id) => {
        const { cards, selectedCardId } = get();
        const idx = cards.findIndex((c) => c.id === id);
        const removed = cards[idx];
        if (!removed) return;
        set({ cards: cards.filter((c) => c.id !== id), selectedCardId: selectedCardId === id ? null : selectedCardId });
        get().showToast({
          message: `“${removed.name}” removed`,
          actionLabel: 'Undo',
          action: () =>
            set((s) => {
              const next = [...s.cards];
              next.splice(idx, 0, removed);
              return { cards: next };
            }),
        });
      },

      /* ---------- transactions ---------- */
      upsertTransaction: (t) =>
        set((s) => {
          if (t.id && s.transactions.some((x) => x.id === t.id)) {
            return { transactions: s.transactions.map((x) => (x.id === t.id ? ({ ...x, ...t } as Transaction) : x)) };
          }
          const id = t.id ?? uid();
          const tx: Transaction = { ...t, id, seriesId: t.recurring ? t.seriesId ?? id : undefined };
          return { transactions: [...s.transactions, tx] };
        }),
      deleteTransaction: (id) => {
        const removed = get().transactions.find((t) => t.id === id);
        if (!removed) return;
        set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
        get().showToast({
          message: `${removed.merchant} deleted`,
          actionLabel: 'Undo',
          action: () => set((s) => ({ transactions: [...s.transactions, removed] })),
        });
      },
      importTransactions: (rows) => {
        const txs = rows.map((r) => ({ ...r, id: uid() }));
        set((s) => ({ transactions: [...s.transactions, ...txs] }));
        return txs.length;
      },

      /* ---------- categories & budgets ---------- */
      addCategory: (c) => {
        const cat = { ...c, id: uid() };
        set((s) => ({ categories: [...s.categories, cat] }));
        return cat;
      },
      updateCategory: (id, patch) =>
        set((s) => ({ categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
      deleteCategory: (id) =>
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          budgets: s.budgets.filter((b) => b.categoryId !== id), // a budget cannot outlive its category
          transactions: s.transactions.map((t) => (t.categoryId === id ? { ...t, categoryId: null } : t)),
        })),
      setBudget: (categoryId, limit) => {
        const { categories, budgets } = get();
        if (!categories.some((c) => c.id === categoryId) || !(limit > 0)) return false;
        const existing = budgets.find((b) => b.categoryId === categoryId);
        set({
          budgets: existing
            ? budgets.map((b) => (b.id === existing.id ? { ...b, limit } : b))
            : [...budgets, { id: uid(), categoryId, limit }],
        });
        return true;
      },
      deleteBudget: (id) => set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) })),

      /* ---------- ui ---------- */
      selectCard: (id) => set({ selectedCardId: id }),
      stepCard: (delta) => {
        const { cards, selectedCardId } = get();
        if (!cards.length) return;
        const i = Math.max(0, cards.findIndex((c) => c.id === selectedCardId));
        const next = Math.min(cards.length - 1, Math.max(0, i + delta));
        set({ selectedCardId: cards[next].id });
      },
      setStatsMode: (statsMode) => set({ statsMode }),
      setChartType: (chartType) => set({ chartType }),
      setActivityFollowsCard: (activityFollowsCard) => set({ activityFollowsCard }),
      setCurrency: (currency) => set({ currency }),
      setProfileName: (profileName) => set({ profileName }),
      setAvatar: (avatar) => set({ avatar }),
      setTheme: (theme) => set({ theme }),
      setAi: (p) => set(p),
      showToast: (t) => set({ toast: { ...t, id: uid() } }),
      dismissToast: () => set({ toast: null }),

      /* ---------- lifecycle ---------- */
      /**
       * Monthly refresh cycle. On the first launch in a new month:
       *  1. every recurring series gets an occurrence for each missed month
       *     (same day-of-month, clamped to month length), and
       *  2. activeMonth moves forward — older months become the archive.
       */
      rollover: () => {
        const { activeMonth, transactions } = get();
        const now = currentMonth();
        if (activeMonth >= now) return;

        const latestBySeries = new Map<string, Transaction>();
        for (const t of transactions) {
          if (!t.recurring) continue;
          const key = t.seriesId ?? t.id;
          const prev = latestBySeries.get(key);
          if (!prev || t.date > prev.date) latestBySeries.set(key, t);
        }

        const generated: Transaction[] = [];
        latestBySeries.forEach((t, seriesId) => {
          let m = addMonths(monthKey(t.date), 1);
          const day = Number(t.date.slice(8, 10));
          while (m <= now) {
            const d = Math.min(day, daysInMonth(m));
            generated.push({ ...t, id: uid(), seriesId, date: `${m}-${String(d).padStart(2, '0')}` });
            m = addMonths(m, 1);
          }
        });

        set({ activeMonth: now, transactions: [...transactions, ...generated] });
        if (generated.length) {
          get().showToast({ message: `New month — ${generated.length} scheduled ${generated.length === 1 ? 'entry' : 'entries'} added` });
        }
      },
      loadData: (d) => set((s) => ({ ...s, ...d })),
      resetAll: () => set((s) => ({ ...emptyData(), theme: s.theme, aiEndpoint: s.aiEndpoint, selectedCardId: null, statsMode: 'card' })),
    }),
    {
      name: 'wallet-tracker-v1',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v2: default categories move to the new palette (only if the user never recoloured them)
      migrate: (persisted, from) => {
        const s = persisted as Partial<DataSlice>;
        if (from < 2 && s.categories) {
          const fresh = new Map(DEFAULT_CATEGORIES.map((c) => [c.id, c.color]));
          s.categories = s.categories.map((c) => (fresh.has(c.id) && LEGACY_COLORS.includes(c.color) ? { ...c, color: fresh.get(c.id)! } : c));
        }
        return s as State;
      },
      skipHydration: true, // rehydrated in <AppShell> after mount to avoid SSR mismatches
      partialize: (s) => ({
        cards: s.cards,
        transactions: s.transactions,
        categories: s.categories,
        budgets: s.budgets,
        currency: s.currency,
        profileName: s.profileName,
        avatar: s.avatar,
        theme: s.theme,
        aiEndpoint: s.aiEndpoint,
        voiceReplies: s.voiceReplies,
        autoAdd: s.autoAdd,
        activeMonth: s.activeMonth,
        chartType: s.chartType,
        selectedCardId: s.selectedCardId,
      }),
    },
  ),
);

/* Convenience hooks */
export const useSelectedCard = () =>
  useStore((s) => s.cards.find((c) => c.id === s.selectedCardId) ?? null);
