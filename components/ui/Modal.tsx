'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { easeOut, springSheet } from '@/lib/motion';
import { useIsDesktop } from '@/lib/useMedia';

/**
 * Centered modal (modals stay origin-centered). Scrim dims + background content
 * blurs to focus the task; Esc and scrim click dismiss. Enter/exit share a path.
 */
export function Modal({ open, onClose, title, children, footer, width = 520 }: {
  open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; footer?: ReactNode; width?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const desktop = useIsDesktop();
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="modal-root" className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-8"
          initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1, transition: { duration: 0.18 } }}>
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: easeOut }}
            onClick={onClose}
          />
          <motion.div
            role="dialog" aria-modal="true"
            className="relative flex max-h-[92svh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-[28px] bg-elevated lg:max-w-[480px] lg:rounded-[24px] lg:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)]"
            data-width={width}
            initial={desktop ? { opacity: 0, scale: 0.96, y: 12 } : { y: '100%' }}
            animate={desktop ? { opacity: 1, scale: 1, y: 0 } : { y: 0 }}
            exit={desktop ? { opacity: 0, scale: 0.97, y: 8, transition: { duration: 0.16, ease: easeOut } } : { y: '100%', transition: { duration: 0.22, ease: easeOut } }}
            transition={springSheet}
          >
            <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-label3/40 lg:hidden" />
            {title !== undefined && (
              <div className="flex items-center justify-between px-5 pb-1 pt-3">
                <h2 className="text-[17px] font-semibold">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="pressable grid size-8 place-items-center rounded-full bg-soft text-label2">
                  <X size={16} strokeWidth={2.4} />
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-5 pb-5 pt-2">{children}</div>
            {footer && <div className="flex items-center justify-end gap-2 border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
