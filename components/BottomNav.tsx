'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeftRight, ChartColumn, House, Plus, User } from 'lucide-react';
import { useSheet } from '@/lib/sheet';
import { useStore } from '@/lib/store';
import { springSnappy } from '@/lib/motion';
import { useHoldToTalk } from '@/lib/useHold';

const LEFT = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/activity', label: 'Transaction', Icon: ArrowLeftRight },
];
const RIGHT = [
  { href: '/stats', label: 'Analytics', Icon: ChartColumn },
  { href: '/settings', label: 'Profile', Icon: User },
];

/** Tab bar with a raised + button in the middle. */
export function BottomNav() {
  const path = usePathname().replace(/\/$/, '') || '/';
  const open = useSheet((s) => s.open);
  const selectedCardId = useStore((s) => s.selectedCardId);
  const hold = useHoldToTalk(() => open({ cardId: selectedCardId }));

  const Item = ({ href, label, Icon }: (typeof LEFT)[number]) => {
    const active = href === '/' ? path === '/' || path === '/budget' : path.startsWith(href);
    return (
      <Link href={href} aria-current={active ? 'page' : undefined}
        className={`pressable flex flex-col items-center gap-1 pt-2 text-[11px] transition-colors ${active ? 'font-semibold text-label' : 'font-medium text-label3 hover:text-label2'}`}>
        <Icon size={21} strokeWidth={active ? 2.3 : 1.8} fill={active && href === '/' ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
        {label}
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-1/2 z-40 lg:hidden w-full max-w-[440px] -translate-x-1/2 border-t border-line bg-elevated/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      <div className="grid h-[66px] grid-cols-5 items-start">
        {LEFT.map((i) => <Item key={i.href} {...i} />)}
        <div className="flex justify-center">
          <motion.button
            aria-label="Add transaction (hold to speak)" title="Tap to add · hold to speak"
            animate={{ scale: hold.pressing ? 0.9 : 1 }} transition={springSnappy}
            {...hold.handlers}
            className="relative -mt-5 grid size-[54px] place-items-center rounded-full bg-accent text-white shadow-[0_10px_22px_-8px_rgb(var(--accent)/0.75)] ring-[5px] ring-canvas"
          >
            {/* fills while held, so the hold is discoverable */}
            {hold.pressing && (
              <motion.span className="absolute -inset-[5px] rounded-full border-[3px] border-accent/50"
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1.12, opacity: 1 }} transition={{ duration: 0.38, ease: 'easeOut' }} />
            )}
            <Plus size={26} strokeWidth={2.4} />
          </motion.button>
        </div>
        {RIGHT.map((i) => <Item key={i.href} {...i} />)}
      </div>
    </nav>
  );
}
