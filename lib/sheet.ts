'use client';

import { create } from 'zustand';
import type { Transaction } from './types';
import { today } from './dates';

export type Draft = Omit<Transaction, 'id'> & { id?: string };

export const blankDraft = (over: Partial<Draft> = {}): Draft => ({
  type: 'expense', amount: 0, merchant: '', categoryId: null, cardId: null, toCardId: null, date: today(), note: '', recurring: false, ...over,
});

/** The add / edit transaction sheet is global: the + button, rows and pages all open it. */
export const useSheet = create<{ draft: Draft | null; open: (d?: Partial<Draft> | Transaction) => void; close: () => void }>((set) => ({
  draft: null,
  open: (d) => set({ draft: blankDraft(d as Partial<Draft>) }),
  close: () => set({ draft: null }),
}));
