import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { AppShell } from '@/components/AppShell';

// SF Pro Display — the three supplied weights. Everything else (600 etc.) snaps to the nearest of these.
const sf = localFont({
  src: [
    { path: './fonts/SFProDisplay-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/SFProDisplay-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/SFProDisplay-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sf',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Wallet — Expense Tracker',
  description: 'An Apple Wallet–style expense tracker.',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sf.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
