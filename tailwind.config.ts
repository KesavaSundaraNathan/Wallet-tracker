import type { Config } from 'tailwindcss';

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  darkMode: 'media', // follow the system, like native Apple apps
  theme: {
    extend: {
      colors: {
        outer: token('outer'),
        canvas: token('canvas'),
        soft: token('soft'),
        line: token('line'),
        ink: token('ink'),
        onink: token('on-ink'),
        elevated: token('elevated'),
        fill: token('fill'),
        label: token('label'),
        label2: token('label-2'),
        label3: token('label-3'),
        sep: token('sep'),
        accent: token('accent'),
        ok: token('green'),
        bad: token('red'),
        warn: token('orange'),
      },
      fontFamily: {
        sans: ['var(--font-sf)', '-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', 'system-ui', '"Segoe UI Variable"', '"Segoe UI"', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        // Display scale: oversized, tightly tracked, used for editorial headings and hero figures
        hero: ['clamp(52px, 9vw, 104px)', { lineHeight: '0.94', letterSpacing: '-0.048em', fontWeight: '700' }],
        display: ['clamp(40px, 6.4vw, 76px)', { lineHeight: '0.98', letterSpacing: '-0.042em', fontWeight: '700' }],
        // Apple HIG text styles (size / leading / tracking). SF Pro Display runs tight at small sizes, so tracking opens up slightly.
        'large-title': ['34px', { lineHeight: '41px', letterSpacing: '-0.022em', fontWeight: '700' }],
        title1: ['28px', { lineHeight: '34px', letterSpacing: '-0.02em', fontWeight: '700' }],
        title2: ['22px', { lineHeight: '28px', letterSpacing: '-0.017em', fontWeight: '700' }],
        title3: ['20px', { lineHeight: '25px', letterSpacing: '-0.015em', fontWeight: '600' }],
        headline: ['15px', { lineHeight: '20px', letterSpacing: '-0.009em', fontWeight: '600' }],
        body: ['15px', { lineHeight: '20px', letterSpacing: '0.002em' }],
        callout: ['14px', { lineHeight: '19px', letterSpacing: '0.004em' }],
        footnote: ['13px', { lineHeight: '18px', letterSpacing: '0.006em' }],
        caption: ['12px', { lineHeight: '16px', letterSpacing: '0' }],
        caption2: ['11px', { lineHeight: '13px', letterSpacing: '0.006em' }],
      },
      borderRadius: {
        card: '18px', // credit card corner at ~380px width
        panel: '20px', // grouped panels
        control: '10px', // inputs, small buttons
      },
      boxShadow: {
        card: '0 1px 1px rgb(0 0 0 / 0.06), 0 8px 16px -6px rgb(0 0 0 / 0.18), 0 22px 40px -18px rgb(0 0 0 / 0.35)',
        panel: '0 1px 2px rgb(0 0 0 / 0.04), 0 8px 24px -12px rgb(0 0 0 / 0.12)',
        float: '0 10px 40px -10px rgb(0 0 0 / 0.35), 0 2px 6px rgb(0 0 0 / 0.08)',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
        drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
