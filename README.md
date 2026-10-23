# Wallet: an Apple Wallet–style expense tracker

Built with Next.js 16 (App Router), React 19, Tailwind CSS 4, Framer Motion and Zustand. It runs entirely in the browser, keeps its data in localStorage, and builds to a static site.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export → ./out  (upload to GitHub Pages / Infinity Free)
```

---

## 1. Project architecture

```
app/
  layout.tsx            Root: <AppShell> (hydration, nav, toasts, reduced-motion)
  template.tsx          Per-route blur-in page transition
  globals.css           Apple system-colour tokens (light + dark), materials, controls
  page.tsx              ① Wallet: empty state / WalletStack
  stats/page.tsx        ② Stats: CardCarousel ⇄ OverviewStack + charts
  activity/page.tsx     ③ Transaction log: search, filters, archive, recurring, edit
  budget/page.tsx       ④ Budgets: income vs expense, rings, category-first rule
  settings/page.tsx     ⑤ Settings: CardStudio, Import, Export, preferences

components/
  AppShell.tsx          Rehydrates the store, runs monthly rollover, hides chrome on empty wallet
  NavPill.tsx           Clip-path tab pill (leading edge fast, trailing edge follows)
  card/themes.ts        Visa / Mastercard / Amex faces + finishes (from the reference images)
  card/WalletCard.tsx   Container-query card face (thumbnail → hero), springed specular glare
  wallet/WalletStack.tsx  Stack → hover part → select "pop" → deck → activity fade-in
  stats/CardCarousel.tsx  Swipe carousel (1:1 drag, momentum projection, velocity hand-off)
  charts/               DonutChart (graphic ring), BarChart (stacked in overview), LineChart (scrub)
  activity/             TransactionRow, TransactionEditor (create/edit any month)
  budget/Ring.tsx       Activity-ring progress with over-budget second lap
  settings/             CardStudio (add/edit/delete + live preview), ImportPanel, ExportDialog
  ui/                   Modal, Segmented, Dropdown, Switch, Field/Group, Toast

lib/
  types.ts              Card, Transaction, Category, Budget
  store.ts              Zustand store (single source of truth, persisted)
  selectors.ts          Pure derivations used by every page
  importer.ts           CSV/XLSX parse → column mapping → standard format
  exporter.ts           Type A statement (CSV/PDF), Type B visual PDF report
  motion.ts             Spring + easing tokens, Apple momentum projection
  dates.ts, format.ts, sample.ts, useMeasure.ts
```

## 2. State management: how card selection connects the pages

There is **one store** (`lib/store.ts`), persisted to `localStorage` under `wallet-tracker-v1`.

```ts
// data (persisted)
cards, transactions, categories, budgets, currency, activeMonth
// shared UI state
selectedCardId   // ← the link between Wallet, Stats and Activity
statsMode        // 'card' | 'overview'
chartType        // 'pie' | 'bar' | 'line' (persisted)
activityFollowsCard
```

Every page derives what it shows from the raw data using the pure functions in `lib/selectors.ts`. Nothing derived is stored, so the pages can never disagree with each other.

```
                ┌────────────── selectedCardId ──────────────┐
 Wallet (tap card) ── selectCard(id) ──►  store  ◄── selectCard(cards[i].id) ── Stats (swipe)
        │                                   │
        │ "See all" → setActivityFollowsCard(true)
        ▼                                   ▼
 Activity opens filtered to selectedCardId   Stats opens on that card;
                                             forCard(transactions, id) → byCategory / monthlyBars / cumulativeDaily
                                             double-tap → statsMode='overview' → all transactions, byCard()
```

* **Wallet → Stats:** pick a card in the wallet and Stats opens on that same card. Swipe in Stats and the wallet shows the new card as selected.
* **Wallet → Activity:** "See all" turns on `activityFollowsCard`, so Activity opens already filtered to the selected card.
* **Stats overview:** double-tapping switches `statsMode`. The same charts are then fed every transaction: the donut groups spending by payment mode and the bars stack per card.
* **Hydration:** the store uses `skipHydration`. `AppShell` calls `persist.rehydrate()` after mount, which avoids SSR mismatches in the static export. It then runs `rollover()`.

### Rules enforced in the store, not only in the UI
* `setBudget(categoryId, limit)` returns `false` unless the category exists, so a budget can never be created before its category. `deleteCategory` also removes that category's budget.
* `rollover()` is the monthly refresh. On the first launch in a new month it creates the next occurrence of every recurring series, one per missed month on the same day, and moves `activeMonth` forward. Activity treats earlier months as the archive, and archived entries can still be edited.
* Deleting a card or a transaction shows an Undo toast.

## 3. Design system
* **Colour:** Apple system colours as RGB tokens with light and dark sets (`globals.css`). The theme follows `prefers-color-scheme`, and theme swaps ease over 300ms.
* **Type:** the system font stack and the HIG text styles (Large Title 34/41 at −0.022em down to Caption 2), with tabular numbers for money.
* **Radii:** card 18px (4.6% of card width), panels 20px, controls 10px, pills fully round.
* **Materials:** `.glass` uses `backdrop-filter: blur(24px) saturate(180%)` with a hairline border. It falls back to a solid surface under `prefers-reduced-transparency`.
* **Motion:** critically damped springs by default. Bounce is used only after a selection or a flick (wallet pop, carousel release). Custom ease-out curves, no `ease-in`. Gesture velocity is handed off to the spring. `MotionConfig reducedMotion="user"`.

## 4. Card faces and brand marks
Each network's face style comes from the attached references: Visa navy with a diagonal stripe field, Mastercard champagne with an arc and a hairline orbit, and Amex metallic with a guilloche texture and an inset frame. The Figma glass mesh finishes are included too. Network names are set in plain type. For production, drop each network's official acceptance-mark SVG (from its brand centre) into `NetworkMark` in `WalletCard.tsx`.

## 5. Import format
Standard columns: `date, merchant, amount, category, payment_mode, type, note, recurring`. A template can be downloaded from Settings. Any CSV or Excel (.xlsx) layout can be mapped onto these columns. Old .xls files must be re-saved as .xlsx or .csv.
* Unknown categories are created on import.
* Payment modes are matched by card name or last 4 digits.
* If the file has no type column but contains signed amounts, negative values become expenses and positive values become income.
