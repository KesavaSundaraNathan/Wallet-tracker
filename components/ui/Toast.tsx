'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { useStore } from '@/lib/store';
import { easeOut, springSnappy } from '@/lib/motion';

/** Bottom-centre pill with an optional Undo — enters and leaves along the same path. */
export function Toaster() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    let timer = window.setTimeout(dismiss, 4500);
    // pause while the tab is hidden
    const vis = () => { window.clearTimeout(timer); if (!document.hidden) timer = window.setTimeout(dismiss, 2500); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.clearTimeout(timer); document.removeEventListener('visibilitychange', vis); };
  }, [toast, dismiss]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] lg:bottom-28 flex justify-center px-4">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 16, scale: 0.98, filter: 'blur(4px)', transition: { duration: 0.18, ease: easeOut } }}
            transition={springSnappy}
            className={`pointer-events-auto ${toast.action ? 'pr-2' : 'pr-4'} flex items-center gap-3 rounded-full bg-ink py-2 pl-4 text-[13px] font-medium text-onink shadow-float `}
          >
            <span className="py-1">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => { toast.action?.(); dismiss(); }}
                className="pressable rounded-full bg-accent px-3 py-1 text-[12px] font-semibold text-white"
              >
                {toast.actionLabel ?? 'Undo'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
