'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Mic, XCircle } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useVoice } from '@/lib/voice';
import { checkEndpoint, DEFAULT_AI_ENDPOINT } from '@/lib/ai';
import { Switch } from '@/components/ui/Switch';

/** Connect the voice assistant to your Cloudflare Worker. The URL is public; the NVIDIA key never comes here. */
export function AiSettings() {
  const { aiEndpoint, voiceReplies, autoAdd, setAi } = useStore();
  const openVoice = useVoice((s) => s.openVoice);
  const [url, setUrl] = useState(aiEndpoint);
  const [test, setTest] = useState<{ state: 'idle' | 'busy' | 'ok' | 'bad'; msg?: string }>({ state: 'idle' });

  const save = async () => {
    const clean = url.trim().replace(/\/$/, '');
    if (clean && !/^https:\/\/|^http:\/\/localhost/.test(clean)) { setTest({ state: 'bad', msg: 'Use the https:// address of your worker.' }); return; }
    setAi({ aiEndpoint: clean });
    if (!clean) { setTest({ state: 'idle' }); return; }
    setTest({ state: 'busy' });
    const r = await checkEndpoint(clean);
    setTest({ state: r.ok ? 'ok' : 'bad', msg: r.message });
  };

  return (
    <div className="panel divide-y divide-line overflow-hidden">
      <div className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[14px] font-medium">Assistant URL</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${aiEndpoint ? 'bg-accent/10 text-accent' : 'bg-soft text-label2'}`}>{aiEndpoint ? 'AI (NVIDIA)' : 'Basic mode'}</span>
        </div>
        <p className="mt-0.5 text-[11.5px] text-label2">Your Cloudflare Worker address. Leave empty to use the simple on-device parser.</p>
        <div className="mt-2.5 flex gap-2">
          <input className="input" inputMode="url" spellCheck={false} placeholder="https://wallet-ai.yourname.workers.dev"
            value={url} onChange={(e) => { setUrl(e.target.value); setTest({ state: 'idle' }); }} />
          <button className="btn-primary h-auto shrink-0 px-4" onClick={save} disabled={test.state === 'busy'}>
            {test.state === 'busy' ? <Loader2 size={15} className="animate-spin" /> : 'Save & test'}
          </button>
        </div>
        {test.state === 'ok' && <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-ok"><CheckCircle2 size={14} /> {test.msg}</p>}
        {test.state === 'bad' && <p className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-bad"><XCircle size={14} /> {test.msg}</p>}
        {DEFAULT_AI_ENDPOINT && aiEndpoint !== DEFAULT_AI_ENDPOINT && (
          <button className="mt-2 text-[12px] font-semibold text-accent" onClick={() => { setUrl(DEFAULT_AI_ENDPOINT); setAi({ aiEndpoint: DEFAULT_AI_ENDPOINT }); }}>Use the built-in address</button>
        )}
      </div>
      <label className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1">
          <span className="block text-[14px] font-medium">Spoken replies</span>
          <span className="block text-[11.5px] text-label2">The assistant reads its confirmation aloud.</span>
        </span>
        <Switch checked={voiceReplies} onChange={(v) => setAi({ voiceReplies: v })} label="Spoken replies" />
      </label>
      <label className="flex items-center gap-3 px-4 py-3">
        <span className="flex-1">
          <span className="block text-[14px] font-medium">Add without confirming</span>
          <span className="block text-[11.5px] text-label2">Off: you check each transaction before it’s saved.</span>
        </span>
        <Switch checked={autoAdd} onChange={(v) => setAi({ autoAdd: v })} label="Add without confirming" />
      </label>
      <button onClick={openVoice} className="pressable flex w-full items-center gap-3 px-4 py-3 text-left">
        <span className="grid size-9 place-items-center rounded-full bg-accent/10 text-accent"><Mic size={16} /></span>
        <span className="flex-1">
          <span className="block text-[14px] font-medium">Try the assistant</span>
          <span className="block text-[11.5px] text-label2">Tip: on a laptop double-click +; on a phone hold + for 3 seconds.</span>
        </span>
      </button>
    </div>
  );
}
