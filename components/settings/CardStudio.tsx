'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Card, Network } from '@/lib/types';
import { NETWORK_LABEL, THEMES, themeFor } from '@/components/card/themes';
import { WalletCard, type CardFace } from '@/components/card/WalletCard';
import { Segmented } from '@/components/ui/Segmented';
import { Field } from '@/components/ui/Field';
import { easeOut, listItem, springPop } from '@/lib/motion';

const blank = (network: Network = 'visa'): CardFace => ({
  name: '', network, finish: THEMES[network][0].key, nameAlign: 'left', holder: '', last4: '', expiry: '',
});

/**
 * Card creation + management. The live preview is the same <WalletCard> the
 * wallet renders, so whatever is typed blends straight into the card face.
 * Picking a network swaps the face style (Visa / Mastercard / Amex references).
 */
export function CardStudio() {
  const { cards, addCard, updateCard, deleteCard, showToast, selectCard } = useStore();
  const [draft, setDraft] = useState<CardFace>(blank());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const errors = useMemo(() => ({
    name: !draft.name.trim() ? 'Give this card a name' : null,
    last4: draft.last4 && !/^\d{4}$/.test(draft.last4) ? 'Use exactly 4 digits' : null,
    expiry: draft.expiry && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(draft.expiry) ? 'Use MM/YY' : null,
  }), [draft]);
  const valid = !errors.name && !errors.last4 && !errors.expiry;

  const set = <K extends keyof CardFace>(k: K, v: CardFace[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setNetwork = (n: Network) => setDraft((d) => ({ ...d, network: n, finish: THEMES[n][0].key }));

  const startEdit = (c: Card) => {
    setEditingId(c.id);
    setDraft({ name: c.name, network: c.network, finish: c.finish, nameAlign: c.nameAlign, holder: c.holder, last4: c.last4, expiry: c.expiry });
    document.getElementById('add-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const reset = () => { setEditingId(null); setDraft(blank(draft.network)); setTouched(false); };

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    const clean = { ...draft, name: draft.name.trim(), holder: draft.holder.trim().toUpperCase() };
    if (editingId) {
      updateCard(editingId, clean);
      showToast({ message: `“${clean.name}” updated` });
    } else {
      const c = addCard(clean);
      selectCard(c.id);
      showToast({ message: `“${c.name}” added to Wallet` });
    }
    reset();
  };

  // focus name when arriving from the empty wallet ("Tap to add card")
  useEffect(() => {
    if (window.location.hash === '#add-card') document.getElementById('card-name')?.focus({ preventScroll: true });
  }, []);

  return (
    <div className="space-y-6">
      <section id="add-card" className="scroll-mt-4">
        <h3 className="section-title">{editingId ? 'Edit card' : 'Add a card'}</h3>
        <div className="panel grid gap-6 p-4">
          {/* ---------- live preview ---------- */}
          <div className="flex flex-col items-center justify-center gap-4">
            <motion.div
              key={draft.network + draft.finish}
              initial={{ rotateY: -8, scale: 0.97, opacity: 0.6 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={springPop}
              className="w-full max-w-[340px] rounded-card shadow-card"
              style={{ transformPerspective: 800 }}
            >
              <WalletCard card={draft} interactive />
            </motion.div>
            <div className="flex items-center gap-2">
              {THEMES[draft.network].map((t) => (
                <button
                  key={t.key}
                  title={t.label}
                  aria-label={`${t.label} finish`}
                  onClick={() => set('finish', t.key)}
                  className="pressable relative size-7 rounded-full shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.2)]"
                  style={{ background: t.background }}
                >
                  {draft.finish === t.key && (
                    <motion.span layoutId="finish-ring" className="absolute -inset-[3px] rounded-full ring-2 ring-accent" transition={{ type: 'spring', bounce: 0, duration: 0.25 }} />
                  )}
                </button>
              ))}
              <span className="ml-1 text-footnote text-label2">{themeFor(draft.network, draft.finish).label}</span>
            </div>
          </div>

          {/* ---------- form ---------- */}
          <div className="space-y-4">
            <Field label="Card type">
              <Segmented<Network>
                value={draft.network}
                onChange={setNetwork}
                className="w-full"
                options={(['visa', 'mastercard', 'amex'] as Network[]).map((n) => ({ value: n, label: n === 'amex' ? 'Amex' : NETWORK_LABEL[n] }))}
              />
            </Field>
            <Field label="Card name" hint="Shown on the card face" error={touched ? errors.name : null}>
              <div className="flex gap-2">
                <input id="card-name" className="input" maxLength={22} value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Everyday, Travel, Business" />
                <Segmented<'left' | 'right'>
                  size="sm"
                  value={draft.nameAlign}
                  onChange={(v) => set('nameAlign', v)}
                  options={[{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }]}
                  className="shrink-0 self-center"
                />
              </div>
            </Field>
            <Field label="Card holder">
              <input className="input uppercase" maxLength={26} value={draft.holder} onChange={(e) => set('holder', e.target.value)} placeholder="NAME ON CARD" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Last 4 digits" error={touched ? errors.last4 : null}>
                <input className="input tabular" inputMode="numeric" maxLength={4} value={draft.last4} onChange={(e) => set('last4', e.target.value.replace(/\D/g, ''))} placeholder="1234" />
              </Field>
              <Field label="Expiry" error={touched ? errors.expiry : null}>
                <input
                  className="input tabular" inputMode="numeric" maxLength={5} value={draft.expiry} placeholder="MM/YY"
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                    set('expiry', v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v);
                  }}
                />
              </Field>
            </div>
            <p className="text-caption text-label3">Only the last four digits are stored — never the full card number.</p>
            <div className="flex justify-end gap-2 pt-2">
              {editingId && <button className="btn-secondary" onClick={reset}>Cancel</button>}
              <button className="btn-primary" onClick={submit}>
                <Check size={15} strokeWidth={2.6} /> {editingId ? 'Save changes' : 'Add to Wallet'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- management ---------- */}
      <section>
        <h3 className="section-title">My cards</h3>
        <div className="panel divide-y divide-line overflow-hidden">
          {cards.length === 0 && <p className="px-4 py-6 text-center text-callout text-label2">No cards yet.</p>}
          <AnimatePresence initial={false}>
            {cards.map((c, i) => (
              <motion.div
                key={c.id}
                layout
                {...listItem(i)}
                exit={{ opacity: 0, height: 0, transition: { duration: 0.2, ease: easeOut } }}
                className={`flex items-center gap-4 px-4 py-3 ${editingId === c.id ? 'bg-accent/[0.06]' : ''}`}
              >
                <div className="w-[72px] shrink-0 overflow-hidden rounded-[6px] shadow-xs"><WalletCard card={c} /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-medium">{c.name}</div>
                  <div className="text-footnote text-label2">{NETWORK_LABEL[c.network]} · {themeFor(c.network, c.finish).label}{c.last4 && ` · •• ${c.last4}`}</div>
                </div>
                <button aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)} className="pressable grid size-8 place-items-center rounded-full text-accent hover:bg-accent/10">
                  <Pencil size={15} />
                </button>
                <button aria-label={`Delete ${c.name}`} onClick={() => { if (editingId === c.id) reset(); deleteCard(c.id); }} className="pressable grid size-8 place-items-center rounded-full text-bad hover:bg-bad/10">
                  <Trash2 size={15} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    </div>
  );
}
