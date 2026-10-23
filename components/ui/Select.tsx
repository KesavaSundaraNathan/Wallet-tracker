'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { easeOut } from '@/lib/motion';

export interface SelectOption { value: string; label: ReactNode; hint?: string }

/**
 * Field-style picker. The menu renders in a portal (never clipped by modals or
 * panels), flips upward near the bottom of the viewport, and is fully themed
 * for light and dark, which native <select> option lists are not.
 */
export function Select({ value, onChange, options, placeholder = 'Select…', disabled, className = '', compact, variant = 'field', icon }: {
  value: string; onChange: (v: string) => void; options: SelectOption[]; placeholder?: string; disabled?: boolean; className?: string; compact?: boolean;
  variant?: 'field' | 'pill'; icon?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; max: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current!.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 16, above = r.top - 16;
      const up = below < 220 && above > below;
      const width = Math.max(r.width, 200);
      setPos({
        left: Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12), width,
        ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }),
        max: Math.min(320, up ? above : below),
      });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !menu.current?.contains(t)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc, true);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc, true); };
  }, [open]);

  useEffect(() => { if (open) menu.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [open, pos]);

  return (
    <>
      <button
        ref={btn} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={variant === 'pill'
          ? `pressable flex h-10 min-w-0 items-center gap-2 rounded-full border border-line bg-elevated px-3.5 text-left text-[13px] font-medium text-label ${open ? 'border-accent/40' : ''} disabled:opacity-50 ${className}`
          : `input flex items-center justify-between gap-2 text-left ${compact ? 'py-1.5 text-[13px]' : ''} ${open ? 'ring-2 ring-accent/40' : ''} disabled:opacity-50 ${className}`}
      >
        {icon && <span className="shrink-0 text-label2">{icon}</span>}
        <span className={`min-w-0 flex-1 truncate ${current ? '' : 'text-label3'}`}>{current?.label ?? placeholder}</span>
        {variant === 'pill' ? <ChevronDown size={14} className="shrink-0 text-label3" /> : <ChevronsUpDown size={14} className="shrink-0 text-label3" />}
      </button>
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={menu} role="listbox"
              initial={{ opacity: 0, scale: 0.96, y: pos.top !== undefined ? -4 : 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
              transition={{ duration: 0.16, ease: easeOut }}
              style={{ position: 'fixed', left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.max, transformOrigin: pos.top !== undefined ? 'top right' : 'bottom right' }}
              className="glass glass-hairline z-[200] overflow-y-auto overscroll-contain rounded-[16px] p-1.5"
            >
              {options.map((o) => {
                const sel = o.value === value;
                return (
                  <button
                    key={o.value} type="button" role="option" aria-selected={sel}
                    onClick={() => { onChange(o.value); setOpen(false); btn.current?.focus(); }}
                    className={`flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] text-label transition-colors duration-100 hover:bg-soft ${sel ? 'font-medium' : ''}`}
                  >
                    <span className="grid w-4 shrink-0 place-items-center">{sel && <Check size={14} strokeWidth={2.8} />}</span>
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {o.hint && <span className="shrink-0 text-footnote opacity-60">{o.hint}</span>}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
