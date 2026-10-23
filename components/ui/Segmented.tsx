'use client';

import { motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { springSnappy } from '@/lib/motion';

/**
 * macOS segmented control. The thumb is one element that springs between measured
 * option rects (no shared-layout ids, so it's safe inside exiting modals).
 */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className = '' }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: 'sm' | 'md'; className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [rect, setRect] = useState<{ x: number; w: number } | null>(null);
  const idx = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const measure = () => {
      const el = refs.current[idx];
      if (el) setRect({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (wrap.current) ro.observe(wrap.current);
    return () => ro.disconnect();
  }, [idx, options.length]);

  return (
    <div ref={wrap} role="radiogroup" className={`relative inline-flex rounded-full bg-soft p-[3px] ${className}`}>
      {rect && (
        <motion.span
          aria-hidden
          className="absolute bottom-[3px] left-0 top-[3px] rounded-full bg-ink"
          initial={false}
          animate={{ x: rect.x, width: rect.w }}
          transition={springSnappy}
        />
      )}
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative flex-1 whitespace-nowrap rounded-full font-semibold transition-colors duration-150 ${size === 'sm' ? 'px-3 py-1 text-[11.5px]' : 'px-3.5 py-1.5 text-[12.5px]'} ${active ? 'text-onink' : 'text-label2 hover:text-label'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
