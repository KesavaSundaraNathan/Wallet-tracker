'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeftRight, ChartColumn, House, Mic, PiggyBank, Plus } from 'lucide-react';
import { useHoldToTalk } from '@/lib/useHold';
import { useVoice } from '@/lib/voice';
import { useSheet } from '@/lib/sheet';
import { useStore } from '@/lib/store';
import { Avatar } from './Avatar';

const LEFT = [
  { href: '/', label: 'Home', Icon: House },
  { href: '/activity', label: 'Transaction', Icon: ArrowLeftRight },
  { href: '/stats', label: 'Analytics', Icon: ChartColumn },
];
const RIGHT = [{ href: '/budget', label: 'Budget', Icon: PiggyBank }];

const spring = { type: 'spring', stiffness: 520, damping: 26 } as const;

/** Laptop navigation: a floating, glassy dock centred at the bottom (Apple style). */
export function Dock() {
  const path = usePathname().replace(/\/$/, '') || '/';
  const open = useSheet((s) => s.open);
  const selectedCardId = useStore((s) => s.selectedCardId);
  const hold = useHoldToTalk(() => open({ cardId: selectedCardId }));
  const openVoice = useVoice((s) => s.openVoice);

  const isActive = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  const Item = ({ href, label, children }: { href: string; label: string; children: React.ReactNode }) => {
    const active = isActive(href);
    return (
      <Link href={href} aria-label={label} aria-current={active ? 'page' : undefined} className="group relative">
        <motion.span whileHover={{ scale: 1.22, y: -6 }} whileTap={{ scale: 0.92 }} transition={spring}
          className={`grid size-12 place-items-center rounded-[16px] transition-colors ${active ? 'bg-soft text-label' : 'text-label2 hover:text-label'}`}>
          {children}
        </motion.span>
        {active && <span className="absolute -bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-label" />}
        <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-medium text-onink opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {label}
        </span>
      </Link>
    );
  };

  return (
    <nav aria-label="Main" className="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 lg:block">
      <div className="flex items-center gap-1.5 rounded-[28px] border border-line bg-elevated/80 p-2 shadow-[0_18px_50px_-14px_rgb(0_0_0/0.35),0_2px_6px_rgb(0_0_0/0.06)] backdrop-blur-2xl">
        {LEFT.map(({ href, label, Icon }) => (
          <Item key={href} href={href} label={label}><Icon size={22} strokeWidth={isActive(href) ? 2.2 : 1.8} /></Item>
        ))}

        <div className="mx-1.5 flex items-center gap-1.5">
          <motion.button {...hold.handlers} aria-label="Add transaction (hold to speak)"
            whileHover={{ scale: 1.1, y: -4 }} animate={{ scale: hold.pressing ? 0.92 : 1 }} transition={spring}
            className="group relative grid size-[54px] place-items-center rounded-full bg-accent text-white shadow-[0_10px_22px_-8px_rgb(var(--accent)/0.75)]">
            {hold.pressing && (
              <motion.span className="absolute -inset-[5px] rounded-full border-[3px] border-accent/50"
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1.1, opacity: 1 }} transition={{ duration: 0.38, ease: 'easeOut' }} />
            )}
            <Plus size={26} strokeWidth={2.4} />
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-medium text-onink opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              Click to add · hold to speak
            </span>
          </motion.button>
          <motion.button onClick={openVoice} aria-label="Add by voice" whileHover={{ scale: 1.15, y: -4 }} whileTap={{ scale: 0.92 }} transition={spring}
            className="group relative grid size-11 place-items-center rounded-full bg-accent/10 text-accent">
            <Mic size={19} />
            <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[11.5px] font-medium text-onink opacity-0 transition-opacity duration-150 group-hover:opacity-100">Voice</span>
          </motion.button>
        </div>

        {RIGHT.map(({ href, label, Icon }) => (
          <Item key={href} href={href} label={label}><Icon size={22} strokeWidth={isActive(href) ? 2.2 : 1.8} /></Item>
        ))}
        <Item href="/settings" label="Profile">
          <span className={`rounded-full ${isActive('/settings') ? 'ring-2 ring-label' : ''}`}><Avatar size={30} /></span>
        </Item>
      </div>
    </nav>
  );
}
