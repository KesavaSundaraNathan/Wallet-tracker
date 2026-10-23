'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { Camera, ChevronRight, Download, PiggyBank, RotateCcw, SunMoon } from 'lucide-react';
import { Avatar, fileToAvatar } from '@/components/Avatar';
import { AiSettings } from '@/components/settings/AiSettings';
import { useStore } from '@/lib/store';
import { CURRENCIES } from '@/lib/format';
import { CardStudio } from '@/components/settings/CardStudio';
import { ImportPanel } from '@/components/settings/ImportPanel';
import { ExportDialog } from '@/components/settings/ExportDialog';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

export default function ProfilePage() {
  const { currency, setCurrency, resetAll, transactions, cards, profileName, setProfileName, avatar, setAvatar, theme, setTheme, showToast } = useStore();
  const photoRef = useRef<HTMLInputElement>(null);
  const onPhoto = async (f?: File) => {
    if (!f) return;
    try { setAvatar(await fileToAvatar(f)); } catch (e) { showToast({ message: (e as Error).message }); }
  };
  const [exportOpen, setExportOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start lg:gap-x-8">
      <header className="order-0 flex h-10 items-center justify-center lg:col-span-2 lg:justify-start">
        <h1 className="text-[16px] font-semibold lg:text-[24px] lg:font-bold lg:tracking-[-0.02em]">Profile</h1>
      </header>
      <div className="contents lg:col-start-1 lg:row-start-2 lg:flex lg:flex-col lg:gap-6">

      {/* identity */}
      <section className="order-1 flex flex-col items-center text-center lg:panel lg:py-6">
        <div className="relative">
          <button onClick={() => photoRef.current?.click()} aria-label="Change profile photo" className="pressable block rounded-full">
            <Avatar size={84} />
          </button>
          <button onClick={() => photoRef.current?.click()} aria-label="Upload photo"
            className="pressable absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-[3px] border-canvas bg-accent text-white">
            <Camera size={14} />
          </button>
          <input ref={photoRef} type="file" accept="image/*" hidden onChange={(e) => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        </div>
        {avatar && <button className="mt-2 text-[12px] font-medium text-bad" onClick={() => setAvatar(null)}>Remove photo</button>}
        <input
          value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={28} placeholder="Your name" aria-label="Your name"
          className="mt-3 w-full max-w-[240px] rounded-full bg-transparent px-3 py-1 text-center text-[18px] font-semibold outline-hidden placeholder:text-label3 focus:bg-soft"
        />
        <p className="text-[12px] text-label2">{cards.length} {cards.length === 1 ? 'card' : 'cards'} · {transactions.length} transactions</p>
      </section>

      

      <section className="order-3">
        <h3 className="section-title">Import data</h3>
        <ImportPanel />
      </section>

      <section className="order-5">
        <h3 className="section-title">Voice assistant</h3>
        <AiSettings />
      </section>

      <section className="order-4">
        <h3 className="section-title">More</h3>
        <div className="panel divide-y divide-line overflow-hidden">
          <Link href="/budget" className="pressable flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-soft text-label2"><PiggyBank size={17} /></span>
            <span className="flex-1 text-[14px] font-medium">Budgets & categories</span>
            <ChevronRight size={16} className="text-label3" />
          </Link>
          <button disabled={!transactions.length} onClick={() => setExportOpen(true)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left disabled:opacity-40">
            <span className="grid size-9 place-items-center rounded-full bg-soft text-label2"><Download size={17} /></span>
            <span className="flex-1">
              <span className="block text-[14px] font-medium">Export data</span>
              <span className="block text-[11.5px] text-label2">CSV / PDF statement or a visual PDF report</span>
            </span>
            <ChevronRight size={16} className="text-label3" />
          </button>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-soft text-[13px] font-bold text-label2">¤</span>
            <span className="flex-1 text-[14px] font-medium">Currency</span>
            <Select compact className="w-[110px]" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-9 place-items-center rounded-full bg-soft text-label2"><SunMoon size={17} /></span>
            <span className="flex-1 text-[14px] font-medium">Appearance</span>
            <Select compact className="w-[124px]" value={theme} onChange={(v) => setTheme(v as typeof theme)}
              options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
          </div>
          <button onClick={() => setConfirmReset(true)} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className="grid size-9 place-items-center rounded-full bg-bad/10 text-bad"><RotateCcw size={16} /></span>
            <span className="flex-1 text-[14px] font-medium text-bad">Reset all data</span>
          </button>
        </div>
      </section>

      </div>
      <div className="order-2 lg:col-start-2 lg:row-start-2"><CardStudio /></div>

      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all data?"
        footer={<>
          <button className="btn-secondary" onClick={() => setConfirmReset(false)}>Cancel</button>
          <button className="btn bg-bad text-white" onClick={() => { resetAll(); setConfirmReset(false); }}>Erase everything</button>
        </>}
      >
        <p className="text-[14px] text-label2">All cards, transactions, categories and budgets on this device will be permanently deleted. This can’t be undone.</p>
      </Modal>
    </div>
  );
}
