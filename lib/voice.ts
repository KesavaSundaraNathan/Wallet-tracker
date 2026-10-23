'use client';

import { create } from 'zustand';

/**
 * Voice mode state. `holding` mirrors the finger on the + button: while it's
 * true the mic listens; letting go sends what was said (walkie-talkie style).
 */
export const useVoice = create<{
  open: boolean; holding: boolean; session: number;
  startHold: () => void; release: () => void; openVoice: () => void; close: () => void;
}>((set) => ({
  open: false, holding: false, session: 0,
  startHold: () => set((s) => ({ open: true, holding: true, session: s.session + 1 })),
  release: () => set({ holding: false }),
  openVoice: () => set((s) => ({ open: true, holding: false, session: s.session + 1 })),
  close: () => set({ open: false, holding: false }),
}));
