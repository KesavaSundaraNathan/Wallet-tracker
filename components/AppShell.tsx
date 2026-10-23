'use client';

import { MotionConfig } from 'framer-motion';
import { useEffect, type ReactNode } from 'react';
import { useStore } from '@/lib/store';
import { BottomNav } from './BottomNav';
import { Dock } from './Dock';
import { AddSheet } from './AddSheet';
import { VoiceSheet } from './VoiceSheet';
import { Toaster } from './ui/Toast';

/** Phone: one column + tab bar. Laptop (lg): floating dock + full-width content. */
export function AppShell({ children }: { children: ReactNode }) {
  const hydrated = useStore((s) => s.hydrated);
  const theme = useStore((s) => s.theme);

  // explicit Light / Dark overrides the system setting
  useEffect(() => {
    if (!hydrated) return;
    const el = document.documentElement;
    if (theme === 'system') delete el.dataset.theme;
    else el.dataset.theme = theme;
  }, [theme, hydrated]);

  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => {
      useStore.setState({ hydrated: true });
      useStore.getState().rollover(); // monthly refresh cycle
    });
    useStore.persist.rehydrate();
    return unsub;
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative mx-auto min-h-svh w-full max-w-[440px] bg-canvas sm:shadow-[0_0_0_1px_rgb(var(--line)),0_30px_80px_-40px_rgb(0_0_0/0.25)] lg:max-w-none lg:shadow-none">
        {hydrated && (
          <>
            <Dock />
            <main className="px-4 pb-32 pt-[max(14px,env(safe-area-inset-top))] lg:mx-auto lg:max-w-[1200px] lg:px-10 lg:pb-36 lg:pt-8">{children}</main>
            <BottomNav />
            <AddSheet />
            <VoiceSheet />
            <Toaster />
          </>
        )}
      </div>
    </MotionConfig>
  );
}
