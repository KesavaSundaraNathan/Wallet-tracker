'use client';

import { memo, useRef } from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import type { Card } from '@/lib/types';
import { NETWORK_LABEL, themeFor, type CardTheme } from './themes';

export type CardFace = Pick<Card, 'name' | 'network' | 'finish' | 'nameAlign' | 'holder' | 'last4' | 'expiry'>;

const NOISE =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

/**
 * A credit card face that scales with its container (all sizes in cqw),
 * so the same component renders a 64px thumbnail and a 420px hero.
 * `interactive` adds a pointer-tracking specular highlight (springed, decorative).
 */
export const WalletCard = memo(function WalletCard({
  card,
  interactive = false,
  className = '',
}: {
  card: CardFace;
  interactive?: boolean;
  className?: string;
}) {
  const theme = themeFor(card.network, card.finish);
  const ref = useRef<HTMLDivElement>(null);
  const mx = useSpring(useMotionValue(30), { stiffness: 120, damping: 20 });
  const my = useSpring(useMotionValue(0), { stiffness: 120, damping: 20 });
  const glare = useMotionTemplate`radial-gradient(60% 80% at ${mx}% ${my}%, rgba(255,255,255,0.28), transparent 60%)`;

  const onMove = (e: React.PointerEvent) => {
    if (!interactive || e.pointerType !== 'mouse' || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width) * 100);
    my.set(((e.clientY - r.top) / r.height) * 100);
  };

  const nameRight = card.nameAlign === 'right';

  return (
    // outer element is the size container; cqw units below resolve against it
    <div className={`w-full ${className}`} style={{ containerType: 'inline-size' }}>
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => { mx.set(30); my.set(0); }}
      className="relative aspect-[1.586/1] w-full select-none overflow-hidden"
      style={{ borderRadius: '4.6cqw', background: theme.background, color: theme.ink }}
    >
      <Pattern theme={theme} />

      {/* light catching the top edge + hairline rim */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0) 38%)' }} />
      {interactive && <motion.div className="pointer-events-none absolute inset-0 mix-blend-soft-light" style={{ background: glare }} />}
      <div className="pointer-events-none absolute inset-0" style={{ borderRadius: 'inherit', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.12)' }} />

      {/* ---------- top strip (visible while stacked) ---------- */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between" style={{ padding: '5.4cqw 6cqw 0' }}>
        {nameRight ? <NetworkMark network={card.network} theme={theme} /> : <CardName name={card.name} />}
        {nameRight ? <CardName name={card.name} align="right" /> : <NetworkMark network={card.network} theme={theme} />}
      </div>

      {/* ---------- chip + contactless ---------- */}
      <div className="absolute flex items-center" style={{ left: '6cqw', top: '35%', gap: '3cqw' }}>
        <Chip />
        <Contactless color={theme.inkSoft} />
      </div>

      {/* ---------- number ---------- */}
      <div className="tabular absolute font-medium" style={{ left: '6cqw', top: '58%', fontSize: '5.6cqw', letterSpacing: '0.13em', color: theme.ink, textShadow: '0 1px 0 rgba(0,0,0,0.12)' }}>
        <span style={{ opacity: 0.7 }}>••••&nbsp;••••&nbsp;••••&nbsp;</span>
        {card.last4 || '0000'}
      </div>

      {/* ---------- bottom row ---------- */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between" style={{ padding: '0 6cqw 5.2cqw' }}>
        <div className="truncate font-medium uppercase" style={{ fontSize: '3.5cqw', letterSpacing: '0.1em', maxWidth: '60%' }}>
          {card.holder || 'Card holder'}
        </div>
        <div className="flex items-end" style={{ gap: '2cqw' }}>
          <div className="text-right leading-none" style={{ color: theme.inkSoft, fontSize: '2cqw', letterSpacing: '0.08em' }}>
            VALID<br />THRU
          </div>
          <div className="tabular font-medium leading-none" style={{ fontSize: '3.7cqw', letterSpacing: '0.06em' }}>{card.expiry || 'MM/YY'}</div>
          {nameRight && <NetworkMark network={card.network} theme={theme} small />}
        </div>
      </div>
    </div>
    </div>
  );
});

function CardName({ name, align = 'left' }: { name: string; align?: 'left' | 'right' }) {
  return (
    <div
      className="truncate font-semibold"
      style={{ fontSize: '5.4cqw', letterSpacing: '-0.015em', lineHeight: 1.1, maxWidth: '58%', textAlign: align, textShadow: '0 1px 1px rgba(0,0,0,0.12)' }}
    >
      {name || 'Card name'}
    </div>
  );
}

/**
 * Network identifier set in plain type. Drop the official acceptance-mark SVGs
 * from each network's brand centre into this component for production.
 */
function NetworkMark({ network, theme, small }: { network: Card['network']; theme: CardTheme; small?: boolean }) {
  const size = small ? 0.7 : 1;
  if (network === 'amex') {
    return (
      <div className="text-right font-bold uppercase leading-[0.95]" style={{ fontSize: `${3 * size}cqw`, letterSpacing: '0.14em', color: theme.ink }}>
        American<br />Express
      </div>
    );
  }
  return (
    <div className="font-bold uppercase" style={{ fontSize: `${4.2 * size}cqw`, letterSpacing: '0.1em', color: theme.ink, opacity: 0.95 }}>
      {NETWORK_LABEL[network]}
    </div>
  );
}

export function Pattern({ theme }: { theme: CardTheme }) {
  switch (theme.pattern) {
    case 'stripes':
      return (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'repeating-linear-gradient(-55deg, rgba(255,255,255,0.075) 0 1.1px, transparent 1.1px 7px)',
            WebkitMaskImage: 'linear-gradient(100deg, transparent 18%, #000 55%)',
            maskImage: 'linear-gradient(100deg, transparent 18%, #000 55%)',
            clipPath: 'polygon(30% 0, 100% 0, 100% 100%, 0 100%, 0 70%)',
          }}
        />
      );
    case 'arc':
      return (
        <>
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              width: '96%', aspectRatio: '1', left: '8%', top: '4%',
              background: 'radial-gradient(rgba(255,255,255,0.16) 0.6px, transparent 0.8px) 0 0 / 4px 4px, rgba(255,255,255,0.06)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          />
          <div className="pointer-events-none absolute rounded-full" style={{ width: '110%', aspectRatio: '1', left: '62%', top: '30%', border: '1px solid rgba(255,255,255,0.8)' }} />
        </>
      );
    case 'guilloche':
      return (
        <>
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'repeating-radial-gradient(circle at 30% 120%, rgba(0,0,0,0.055) 0 0.8px, transparent 0.8px 3.2px), repeating-radial-gradient(circle at 75% -20%, rgba(255,255,255,0.12) 0 0.8px, transparent 0.8px 3.6px)',
            }}
          />
          <div className="pointer-events-none absolute" style={{ inset: '2.6cqw', borderRadius: '2.6cqw', border: `1px solid ${theme.frame}`, boxShadow: `inset 0 0 0 1.6cqw transparent, inset 0 0 0 calc(1.6cqw + 1px) ${theme.frame}` }} />
        </>
      );
    case 'mesh':
      return (
        <>
          <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay" style={{ backgroundImage: NOISE }} />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.18), rgba(255,255,255,0) 50%)', backdropFilter: 'blur(0.5px)' }} />
        </>
      );
  }
}

function Chip() {
  return (
    <svg viewBox="0 0 50 38" style={{ width: '11.5cqw' }} aria-hidden>
      <defs>
        <linearGradient id="chipg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e3a8" />
          <stop offset="0.45" stopColor="#d4b062" />
          <stop offset="1" stopColor="#f1d993" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="49" height="37" rx="7" fill="url(#chipg)" stroke="rgba(120,90,30,0.45)" />
      <g fill="none" stroke="rgba(110,80,25,0.55)" strokeWidth="1">
        <path d="M0 13h15M0 25h15M35 13h15M35 25h15M15 0v38M35 0v38" />
        <rect x="15" y="9" width="20" height="20" rx="4" />
      </g>
    </svg>
  );
}

function Contactless({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: '5.4cqw' }} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M8.5 7.5a6.5 6.5 0 0 1 0 9" />
      <path d="M12 5a10 10 0 0 1 0 14" />
      <path d="M15.5 2.5a13.5 13.5 0 0 1 0 19" />
    </svg>
  );
}
