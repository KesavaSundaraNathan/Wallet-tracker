'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { easeOut } from '@/lib/motion';

/** Popover menu that scales from its trigger (origin-aware), 160ms ease-out. */
export function Dropdown<T extends string>({ value, onChange, options, align = 'right', label }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: ReactNode }[]; align?: 'left' | 'right'; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        aria-haspopup="listbox" aria-expanded={open} aria-label={label}
        onClick={() => setOpen((v) => !v)}
        className="pressable inline-flex h-8 items-center gap-1.5 rounded-full bg-soft pl-3 pr-2.5 text-[12px] font-semibold text-label"
      >
        {current?.icon}
        {current?.label}
        <ChevronDown size={14} strokeWidth={2.4} className={`text-label2 transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.1 } }}
            transition={{ duration: 0.16, ease: easeOut }}
            style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
            className={`glass glass-hairline absolute z-30 mt-2 min-w-[180px] rounded-[16px] p-1.5 ${align === 'right' ? 'right-0' : 'left-0'}`}
          >
            {options.map((o) => (
              <li key={o.value}>
                <button
                  role="option" aria-selected={o.value === value}
                  onClick={() => { onChange(o.value); setOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13.5px] hover:bg-soft"
                >
                  <span className="grid w-4 place-items-center text-accent">{o.value === value && <Check size={14} strokeWidth={2.6} />}</span>
                  {o.icon}
                  {o.label}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
