'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, ArrowUp, Check, Loader2, Mic, Pencil, Repeat, Sparkles, X } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useVoice } from '@/lib/voice';
import { useSheet, type Draft } from '@/lib/sheet';
import { useMoney } from '@/lib/format';
import { parseISODate } from '@/lib/dates';
import { aiContext, askAssistant, toDrafts, type ChatMsg } from '@/lib/ai';
import { speak, speechSupported, stopSpeaking, useSpeech } from '@/lib/speech';
import { useIsDesktop } from '@/lib/useMedia';
import { easeOut, springSheet } from '@/lib/motion';

const PALETTE = ['#2E5BEA', '#3AA676', '#F4C542', '#F0582B', '#7A5AF8', '#22B8CF', '#EE46BC', '#0BA5EC'];
type Phase = 'idle' | 'listening' | 'thinking' | 'review' | 'question' | 'done' | 'error';
type Item = { draft: Draft; newCategory: string | null };

export function VoiceSheet() {
  const open = useVoice((s) => s.open);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<AnimatePresence>{open && <VoiceBody key="voice" />}</AnimatePresence>, document.body);
}

function VoiceBody() {
  const { holding, session, close, release } = useVoice();
  const { categories, cards, currency, aiEndpoint, voiceReplies, autoAdd, upsertTransaction, addCategory, showToast } = useStore();
  const openSheet = useSheet((s) => s.open);
  const money = useMoney();
  const desktop = useIsDesktop();

  const [phase, setPhase] = useState<Phase>('idle');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [reply, setReply] = useState('');
  const [typed, setTyped] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const heardRef = useRef('');

  const say = useCallback((t: string) => { if (voiceReplies) speak(t); }, [voiceReplies]);

  const commit = useCallback((list: Item[]) => {
    const created = new Map<string, string>();
    list.forEach(({ newCategory }, i) => {
      if (newCategory && !created.has(newCategory.toLowerCase())) {
        const existing = useStore.getState().categories.find((c) => c.name.toLowerCase() === newCategory.toLowerCase());
        created.set(newCategory.toLowerCase(), existing?.id ?? addCategory({ name: newCategory, emoji: '🏷️', color: PALETTE[(categories.length + i) % PALETTE.length] }).id);
      }
    });
    list.forEach(({ draft, newCategory }) => {
      upsertTransaction({ ...draft, categoryId: draft.categoryId ?? (newCategory ? created.get(newCategory.toLowerCase()) ?? null : null) });
    });
    showToast({ message: `Added ${list.length} ${list.length === 1 ? 'transaction' : 'transactions'}` });
  }, [addCategory, categories.length, showToast, upsertTransaction]);

  const process = useCallback(async (text: string) => {
    const clean = text.trim();
    if (!clean) { setPhase('idle'); return; }
    heardRef.current = clean;
    const next: ChatMsg[] = [...messages, { role: 'user', content: clean }];
    setMessages(next);
    setPhase('thinking');
    setErrorText(null);
    try {
      const st = useStore.getState();
      const res = await askAssistant(aiEndpoint, next, aiContext(st.categories, st.cards, st.currency));
      setOffline(!!res.offline);
      setMessages([...next, { role: 'assistant', content: JSON.stringify({ transactions: res.transactions, question: res.question }) }]);
      if (res.question || !res.transactions.length) {
        setReply(res.question || res.reply);
        setItems([]);
        setPhase(res.question ? 'question' : 'idle');
        say(res.question || res.reply);
        return;
      }
      const list = toDrafts(res, st.categories, st.cards);
      setReply(res.reply);
      if (autoAdd) {
        commit(list);
        setItems(list);
        setPhase('done');
        say(res.reply);
      } else {
        setItems(list);
        setPhase('review');
        say(res.reply.replace(/^Added\b/i, 'Ready to add'));
      }
    } catch (e) {
      setErrorText((e as Error).message || 'Something went wrong.');
      setPhase('error');
    }
  }, [aiEndpoint, autoAdd, commit, messages, say]);

  const speech = useSpeech(process);

  // hold-to-talk: listen while the finger is down, send on release
  const heldThisSession = useRef(false);
  useEffect(() => {
    if (holding) { heldThisSession.current = true; stopSpeaking(); speech.start(); setPhase('listening'); }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!holding && heldThisSession.current && speech.listening) { heldThisSession.current = false; speech.stop(); }
  }, [holding, speech]);
  useEffect(() => { if (!speech.listening && phase === 'listening' && !holding) setPhase((p) => (p === 'listening' ? 'idle' : p)); }, [speech.listening]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (speech.error) { setErrorText(speech.error); setPhase('error'); } }, [speech.error]);
  useEffect(() => () => stopSpeaking(), []);

  const toggleMic = () => {
    if (speech.listening) { speech.stop(); return; }
    stopSpeaking();
    speech.setError(null);
    speech.start();
    setPhase('listening');
  };
  const sendTyped = () => { const t = typed; setTyped(''); process(t); };
  const dismiss = () => { speech.cancel(); stopSpeaking(); release(); close(); };
  const startOver = () => { setMessages([]); setItems([]); setReply(''); setPhase('idle'); setErrorText(null); };

  const editItem = (i: number) => {
    const it = items[i];
    dismiss();
    setTimeout(() => openSheet(it.draft), 180);
  };

  const supported = useMemo(() => speechSupported(), []);
  const status = phase === 'listening' ? (holding ? 'Listening… release to send' : 'Listening… tap to stop')
    : phase === 'thinking' ? 'Working it out…'
    : phase === 'review' ? 'Check and add'
    : phase === 'question' ? 'One more thing'
    : phase === 'done' ? 'Added'
    : phase === 'error' ? 'Something went wrong'
    : supported ? 'Tap the mic and say a transaction' : 'Type a transaction below';

  return (
    <motion.div className="fixed inset-0 z-[60]" initial={{ opacity: 1 }} exit={{ opacity: 1, transition: { duration: 0.25 } }}>
      <motion.div className="absolute inset-0 bg-black/45" onClick={dismiss} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center lg:items-center lg:p-8">
        <motion.div role="dialog" aria-modal="true" aria-label="Voice assistant"
          className="pointer-events-auto flex max-h-[92svh] w-full max-w-[440px] flex-col rounded-t-[28px] bg-elevated lg:rounded-[28px] lg:shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)]"
          initial={desktop ? { opacity: 0, scale: 0.96 } : { y: '100%' }} animate={desktop ? { opacity: 1, scale: 1 } : { y: 0 }}
          exit={desktop ? { opacity: 0, scale: 0.97, transition: { duration: 0.15 } } : { y: '100%', transition: { duration: 0.22, ease: easeOut } }}
          transition={springSheet}>
          <div className="mx-auto mt-2.5 h-[5px] w-10 shrink-0 rounded-full bg-label3/40 lg:hidden" />
          <header className="flex items-center gap-2 px-4 pt-3">
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${offline || !aiEndpoint ? 'bg-soft text-label2' : 'bg-accent/10 text-accent'}`}>
              <Sparkles size={12} /> {aiEndpoint ? 'AI assistant' : 'Basic mode'}
            </span>
            <span className="flex-1" />
            {messages.length > 0 && phase !== 'thinking' && <button onClick={startOver} className="text-[12.5px] font-semibold text-accent">Start over</button>}
            <button onClick={dismiss} aria-label="Close" className="pressable grid size-8 place-items-center rounded-full bg-soft text-label2"><X size={16} strokeWidth={2.4} /></button>
          </header>

          <div className="overflow-y-auto px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-2">
            {/* orb */}
            <div className="flex flex-col items-center pt-3">
              <button onClick={toggleMic} disabled={!supported || phase === 'thinking'} aria-label={speech.listening ? 'Stop listening' : 'Start listening'}
                className="relative grid size-[104px] place-items-center rounded-full disabled:opacity-50">
                {speech.listening && [0, 1, 2].map((i) => (
                  <motion.span key={i} className="absolute inset-0 rounded-full bg-accent/25"
                    initial={{ scale: 1, opacity: 0.6 }} animate={{ scale: 1.7, opacity: 0 }}
                    transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }} />
                ))}
                <motion.span className="relative grid size-[84px] place-items-center rounded-full bg-accent text-white shadow-[0_14px_30px_-10px_rgb(var(--accent)/0.8)]"
                  animate={{ scale: speech.listening ? [1, 1.06, 1] : 1 }} transition={speech.listening ? { duration: 1.2, repeat: Infinity } : { duration: 0.2 }}>
                  {phase === 'thinking' ? <Loader2 size={30} className="animate-spin" /> : phase === 'done' ? <Check size={32} strokeWidth={2.6} /> : <Mic size={30} />}
                </motion.span>
              </button>
              <p className="mt-3 text-[13px] font-semibold">{status}</p>
              <AnimatePresence mode="wait">
                <motion.p key={speech.listening ? 'live' : heardRef.current} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="mt-1 min-h-[40px] max-w-[340px] text-center text-[14px] leading-snug text-label2">
                  {speech.listening ? (speech.interim || '…') : heardRef.current ? `“${heardRef.current}”` : 'e.g. “Lunch at McD 25 ringgit on AMEX yesterday”'}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* reply / question / error */}
            {(phase === 'question' || (phase === 'idle' && reply)) && (
              <div className="soft-card mt-3 px-4 py-3 text-center text-[14px] font-medium">{reply}</div>
            )}
            {phase === 'error' && errorText && (
              <div className="mt-3 rounded-[16px] bg-bad/10 px-4 py-3 text-center text-[13px] font-medium text-bad">{errorText}</div>
            )}

            {/* parsed transactions */}
            {items.length > 0 && (
              <div className="mt-4 space-y-2">
                {items.map((it, i) => (
                  <ParsedRow key={i} item={it} done={phase === 'done'} money={money} onEdit={() => editItem(i)}
                    onRemove={() => setItems((l) => l.filter((_, k) => k !== i))} />
                ))}
              </div>
            )}

            {phase === 'review' && items.length > 0 && (
              <button className="btn-big mt-4" onClick={() => { commit(items); setPhase('done'); setTimeout(dismiss, 700); }}>
                <Check size={18} strokeWidth={2.6} /> Add {items.length > 1 ? `all ${items.length}` : 'transaction'}
              </button>
            )}
            {phase === 'done' && <button className="btn-big mt-4" onClick={dismiss}>Done</button>}

            {/* typed fallback / answer */}
            <form onSubmit={(e) => { e.preventDefault(); sendTyped(); }} className="relative mt-4">
              <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={300}
                placeholder={phase === 'question' ? 'Type your answer…' : 'Or type it here…'}
                className="input rounded-full pr-12" aria-label="Type a transaction" />
              <button type="submit" disabled={!typed.trim() || phase === 'thinking'} aria-label="Send"
                className="pressable absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-accent text-white disabled:opacity-30">
                <ArrowUp size={16} strokeWidth={2.6} />
              </button>
            </form>
            {!aiEndpoint && (
              <p className="mt-2 text-center text-[11px] text-label3">Basic mode understands simple sentences. Connect the AI assistant in Profile for anything more.</p>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function ParsedRow({ item, done, money, onEdit, onRemove }: { item: Item; done: boolean; money: (v: number, o?: { sign?: boolean }) => string; onEdit: () => void; onRemove: () => void }) {
  const { categories, cards } = useStore();
  const d = item.draft;
  const cat = categories.find((c) => c.id === d.categoryId);
  const card = cards.find((c) => c.id === d.cardId);
  const to = cards.find((c) => c.id === d.toCardId);
  const sub = d.type === 'transfer'
    ? `${card?.name ?? 'Choose account'} → ${to?.name ?? 'Choose account'}`
    : [d.type === 'expense' ? cat?.name ?? (item.newCategory ? `${item.newCategory} (new)` : 'Uncategorised') : 'Income', card?.name ?? 'Cash / other'].join(' · ');
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: easeOut }}
      className="soft-card flex items-center gap-3 px-3 py-2.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-elevated text-[18px]">
        {d.type === 'transfer' ? <ArrowLeftRight size={16} className="text-label2" /> : d.type === 'income' ? '💰' : cat?.emoji ?? '🏷️'}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold">{d.merchant}</span>
          {d.recurring && <Repeat size={12} className="shrink-0 text-accent" />}
        </span>
        <span className="block truncate text-[11.5px] text-label2">{sub}</span>
        <span className="block text-[11px] text-label3">{parseISODate(d.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
      </span>
      <span className={`tabular shrink-0 text-[14px] font-semibold ${d.type === 'income' ? 'text-ok' : d.type === 'expense' ? 'text-bad' : ''}`}>
        {d.type === 'transfer' ? money(d.amount) : money(d.type === 'income' ? d.amount : -d.amount, { sign: true }).replace('−', '-')}
      </span>
      {!done && (
        <span className="flex shrink-0 flex-col gap-1">
          <button onClick={onEdit} aria-label="Edit" className="pressable grid size-7 place-items-center rounded-full bg-elevated text-label2"><Pencil size={13} /></button>
          <button onClick={onRemove} aria-label="Remove" className="pressable grid size-7 place-items-center rounded-full bg-elevated text-label3"><X size={13} /></button>
        </span>
      )}
    </motion.div>
  );
}
