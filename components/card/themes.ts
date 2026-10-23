import type { Card, Network } from '@/lib/types';

export type Pattern = 'stripes' | 'arc' | 'guilloche' | 'mesh';

export interface CardTheme {
  key: string;
  label: string;
  /** CSS background stack for the card face */
  background: string;
  pattern: Pattern;
  ink: string;          // primary text
  inkSoft: string;      // secondary text
  frame?: string;       // amex inset frame colour
  accent: string;       // used in charts / legends for this card
  glow: [string, string]; // ambient backdrop colours when this card is selected
  swatch: string;       // finish picker swatch
}

/**
 * Card faces, derived from the reference attachments:
 *  - Visa:       deep navy with diagonal stripe field (visa-card.png) + glass mesh (Figma)
 *  - Mastercard: champagne gold with a large arc and hairline orbit (mastercard.webp)
 *  - Amex:       metallic platinum / gold with guilloche texture and an inset frame
 */
export const THEMES: Record<Network, CardTheme[]> = {
  visa: [
    {
      key: 'midnight', label: 'Midnight', pattern: 'stripes',
      background: 'radial-gradient(120% 90% at 85% 10%, #22356f 0%, transparent 60%), linear-gradient(135deg, #0b1640 0%, #13235c 45%, #0a1233 100%)',
      ink: '#ffffff', inkSoft: 'rgba(255,255,255,0.62)', accent: '#3d5bd9', swatch: '#13235c', glow: ['#3d5bd9', '#1f35a8'],
    },
    {
      key: 'graphite', label: 'Graphite', pattern: 'stripes',
      background: 'radial-gradient(100% 80% at 80% 0%, #4a4a4f 0%, transparent 60%), linear-gradient(140deg, #2a2a2e 0%, #1a1a1d 55%, #0e0e10 100%)',
      ink: '#f5f5f7', inkSoft: 'rgba(245,245,247,0.55)', accent: '#30b0c7', swatch: '#2a2a2e', glow: ['#7b8794', '#30b0c7'],
    },
    {
      key: 'aurora', label: 'Aurora Glass', pattern: 'mesh',
      background: 'radial-gradient(60% 70% at 70% 35%, rgba(255,110,90,0.85) 0%, transparent 60%), radial-gradient(70% 80% at 15% 90%, rgba(120,90,255,0.9) 0%, transparent 60%), radial-gradient(80% 90% at 100% 100%, rgba(80,200,255,0.7) 0%, transparent 55%), linear-gradient(135deg, #3a1f6e 0%, #5b2a86 100%)',
      ink: '#ffffff', inkSoft: 'rgba(255,255,255,0.7)', accent: '#8a5cff', swatch: '#6d3fd1', glow: ['#ff6e5a', '#7a5aff'],
    },
  ],
  mastercard: [
    {
      key: 'gold', label: 'Champagne', pattern: 'arc',
      background: 'radial-gradient(90% 120% at 30% 0%, #d9c9a3 0%, transparent 60%), linear-gradient(135deg, #c9b68c 0%, #b39f74 50%, #a08b60 100%)',
      ink: '#ffffff', inkSoft: 'rgba(255,255,255,0.78)', accent: '#c2a462', swatch: '#bfa97c', glow: ['#e6c77f', '#ff9f0a'],
    },
    {
      key: 'obsidian', label: 'Obsidian', pattern: 'arc',
      background: 'radial-gradient(90% 120% at 30% 0%, #3b3b40 0%, transparent 60%), linear-gradient(135deg, #1f1f22 0%, #121214 100%)',
      ink: '#f5f5f7', inkSoft: 'rgba(245,245,247,0.6)', accent: '#ff8a3d', swatch: '#1f1f22', glow: ['#ff8a3d', '#6b6b73'],
    },
    {
      key: 'sunset', label: 'Sunset Glass', pattern: 'mesh',
      background: 'radial-gradient(70% 80% at 20% 20%, rgba(255,214,10,0.9) 0%, transparent 60%), radial-gradient(70% 90% at 90% 80%, rgba(255,69,58,0.85) 0%, transparent 60%), linear-gradient(135deg, #ff9f0a 0%, #ff6b3d 100%)',
      ink: '#ffffff', inkSoft: 'rgba(255,255,255,0.78)', accent: '#ff7a1a', swatch: '#ff8c1a', glow: ['#ffd60a', '#ff453a'],
    },
  ],
  amex: [
    {
      key: 'platinum', label: 'Platinum', pattern: 'guilloche',
      background: 'linear-gradient(115deg, #e9ebee 0%, #c9ccd1 22%, #f4f5f7 40%, #b9bcc2 62%, #e3e5e8 80%, #a9adb3 100%)',
      ink: '#2b2d31', inkSoft: 'rgba(43,45,49,0.6)', frame: 'rgba(60,62,66,0.45)', accent: '#6b8cae', swatch: '#cfd2d6', glow: ['#9db2d0', '#dfe6f1'],
    },
    {
      key: 'gold', label: 'Gold', pattern: 'guilloche',
      background: 'linear-gradient(115deg, #e8cf86 0%, #c9a74f 24%, #f1dc9a 42%, #b8913a 64%, #e2c573 82%, #a8822f 100%)',
      ink: '#2a2110', inkSoft: 'rgba(42,33,16,0.62)', frame: 'rgba(42,33,16,0.5)', accent: '#d4ad4f', swatch: '#d6b860', glow: ['#f3d57c', '#c9953a'],
    },
    {
      key: 'onyx', label: 'Onyx', pattern: 'guilloche',
      background: 'linear-gradient(115deg, #2c2d30 0%, #151517 30%, #3a3b3f 50%, #121214 75%, #2a2b2e 100%)',
      ink: '#e8e8ea', inkSoft: 'rgba(232,232,234,0.55)', frame: 'rgba(232,232,234,0.35)', accent: '#64d2ff', swatch: '#232326', glow: ['#6a7385', '#64d2ff'],
    },
  ],
};

export const NETWORK_LABEL: Record<Network, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
};

export function themeFor(network: Network, finish: string): CardTheme {
  const list = THEMES[network];
  return list.find((t) => t.key === finish) ?? list[0];
}

export const cardAccent = (c: Pick<Card, 'network' | 'finish'>) => themeFor(c.network, c.finish).accent;
