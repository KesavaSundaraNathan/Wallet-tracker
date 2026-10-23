'use client';

import { motion } from 'framer-motion';
import { springSnappy } from '@/lib/motion';

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch" aria-checked={checked} aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors duration-200 ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <motion.span
        className="absolute top-[2px] size-[22px] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2),0_0_0_0.5px_rgb(0_0_0/0.04)]"
        animate={{ left: checked ? 20 : 2 }}
        transition={springSnappy}
      />
    </button>
  );
}
