/**
 * wallet-ai — Cloudflare Worker
 *
 * The browser never sees the NVIDIA key. The app sends what the user said plus
 * the names of their categories and accounts; this worker adds the key (an
 * encrypted Cloudflare secret), asks the NVIDIA model to turn the sentence into
 * the app's transaction format, checks the answer, and returns clean JSON.
 *
 *   GET  /health  → { ok, model }            (no NVIDIA call, no credits used)
 *   POST /parse   → { reply, question, transactions[] }
 */

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const MAX_MESSAGES = 8;
const MAX_CHARS = 600;
const MAX_NAMES = 60;
const MAX_TX = 10;

// best-effort per-visitor limiter (each Cloudflare location keeps its own counts)
const hits = new Map();
function limited(ip, perMin) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) { hits.set(ip, { n: 1, reset: now + 60_000 }); return false; }
  h.n += 1;
  if (hits.size > 5000) hits.clear();
  return h.n > perMin;
}

function corsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = origin && allowed.includes(origin);
  return {
    ok,
    headers: {
      ...(ok ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin',
    },
  };
}

const json = (body, status, headers) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });

const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);
const names = (arr) => (Array.isArray(arr) ? arr : []).slice(0, MAX_NAMES).map((s) => clip(s, 40)).filter(Boolean);

function systemPrompt(ctx) {
  return `You turn what a user says about their money into transactions for an expense-tracker app.
Reply with ONE JSON object only. No prose, no markdown, no code fences.

Today is ${ctx.weekday}, ${ctx.today}. Currency: ${ctx.currency}.
Expense categories (use one of these exact names, or null): ${JSON.stringify(ctx.categories)}
Accounts / cards (use one of these exact names, "cash", or null): ${JSON.stringify(ctx.accounts)}

JSON shape:
{
  "transactions": [
    {
      "type": "expense" | "income" | "transfer",
      "amount": number,                 // positive, in ${ctx.currency}, max 2 decimals
      "date": "YYYY-MM-DD",
      "title": string,                  // merchant / source / short label, Title Case, max 40 chars
      "category": string | null,        // expenses only; must be from the list
      "newCategory": string | null,     // only if no listed category fits; a short name
      "account": string | null,         // card paid with / deposited to / transfer source
      "toAccount": string | null,       // transfers only: destination
      "recurring": boolean,             // true for "every month", "monthly", subscriptions, rent, salary said as recurring
      "note": string | null
    }
  ],
  "question": string | null,            // ask ONE short question if something essential is missing (usually the amount)
  "reply": string                       // one short sentence to read aloud, e.g. "Added 12.50 for lunch on AMEX today."
}

Rules:
- Resolve relative dates from today: "yesterday", "last Friday", "on the 3rd", "two days ago". Never use a future date unless the user clearly says so.
- Amounts: understand "25", "RM25", "25 ringgit", "twenty five", "1.2k", "25 bucks". Ignore currency words.
- Type: spending/paid/bought/spent → expense; salary/received/got paid/refund/income → income; moved/transferred/topped up from A to B → transfer.
- Match categories and accounts loosely ("food" → "Food & Drink", "amex card" → "AMEX", "touch n go" → "TnG") but output the exact listed name.
- If no account is mentioned, use null. If paid in cash, use "cash".
- Several transactions in one message → several items.
- If the message is not about a transaction, return "transactions": [] and a friendly one-line "reply".
- If the amount is missing, do not guess: return "transactions": [] and put a "question".
- English only.`;
}

function sanitize(raw, ctx) {
  const cats = new Map(ctx.categories.map((c) => [c.toLowerCase(), c]));
  const accts = new Map(ctx.accounts.map((a) => [a.toLowerCase(), a]));
  const pickCat = (v) => (v ? cats.get(String(v).toLowerCase()) ?? null : null);
  const pickAcct = (v) => {
    if (!v) return null;
    const k = String(v).toLowerCase();
    return k === 'cash' ? 'cash' : accts.get(k) ?? null;
  };
  const tx = (Array.isArray(raw?.transactions) ? raw.transactions : []).slice(0, MAX_TX).flatMap((t) => {
    const amount = Math.round(Number(String(t?.amount ?? '').replace(/[^\d.]/g, '')) * 100) / 100;
    const type = ['expense', 'income', 'transfer'].includes(t?.type) ? t.type : 'expense';
    const date = /^\d{4}-\d{2}-\d{2}$/.test(t?.date ?? '') ? t.date : ctx.today;
    if (!(amount > 0) || amount > 1e9) return [];
    return [{
      type, amount, date,
      title: clip(t?.title, 40),
      category: type === 'expense' ? pickCat(t?.category) : null,
      newCategory: type === 'expense' && !pickCat(t?.category) && t?.newCategory ? clip(t.newCategory, 30) : null,
      account: pickAcct(t?.account),
      toAccount: type === 'transfer' ? pickAcct(t?.toAccount) : null,
      recurring: t?.recurring === true,
      note: t?.note ? clip(t.note, 120) : null,
    }];
  });
  return {
    transactions: tx,
    question: raw?.question ? clip(raw.question, 160) : null,
    reply: clip(raw?.reply || (tx.length ? `Got ${tx.length} transaction${tx.length > 1 ? 's' : ''}.` : 'Sorry, I didn’t catch a transaction.'), 200),
  };
}

function firstJson(text) {
  const s = String(text || '').replace(/```(?:json)?/g, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no json');
  return JSON.parse(s.slice(a, b + 1));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(origin, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: cors.ok ? 204 : 403, headers: cors.headers });
    // opening /health directly in a browser tab (no Origin) is allowed, so setup can be checked by hand
    if (url.pathname === '/health' && request.method === 'GET' && !origin) {
      return json({ ok: Boolean(env.NVIDIA_API_KEY), model: env.NVIDIA_MODEL, note: 'Worker is running.' }, 200, {});
    }
    if (!cors.ok) return json({ error: 'Origin not allowed' }, 403, cors.headers);

    if (url.pathname === '/health' && request.method === 'GET') {
      return json({ ok: Boolean(env.NVIDIA_API_KEY), model: env.NVIDIA_MODEL }, 200, cors.headers);
    }
    if (url.pathname !== '/parse' || request.method !== 'POST') return json({ error: 'Not found' }, 404, cors.headers);

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (limited(ip, Number(env.RATE_LIMIT_PER_MIN || 20))) return json({ error: 'Too many requests — try again in a minute.' }, 429, cors.headers);
    if (!env.NVIDIA_API_KEY) return json({ error: 'Assistant is not configured (missing secret).' }, 500, cors.headers);

    let body;
    try {
      if (Number(request.headers.get('Content-Length') || 0) > 20_000) throw new Error('too big');
      body = await request.json();
    } catch {
      return json({ error: 'Bad request' }, 400, cors.headers);
    }

    const c = body?.context ?? {};
    const ctx = {
      today: /^\d{4}-\d{2}-\d{2}$/.test(c.today) ? c.today : new Date().toISOString().slice(0, 10),
      weekday: clip(c.weekday, 12) || 'today',
      currency: clip(c.currency, 5) || 'MYR',
      categories: names(c.categories),
      accounts: names(c.accounts),
    };
    const history = (Array.isArray(body?.messages) ? body.messages : [])
      .slice(-MAX_MESSAGES)
      .map((m) => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: clip(m?.content, MAX_CHARS) }))
      .filter((m) => m.content);
    if (!history.length) return json({ error: 'Say something first.' }, 400, cors.headers);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 25_000);
    try {
      const r = await fetch(NVIDIA_URL, {
        method: 'POST',
        signal: ac.signal,
        headers: { Authorization: `Bearer ${env.NVIDIA_API_KEY}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          model: env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct',
          temperature: 0.1,
          top_p: 0.9,
          max_tokens: 700,
          messages: [{ role: 'system', content: systemPrompt(ctx) }, ...history],
        }),
      });
      if (!r.ok) {
        const msg = r.status === 401 || r.status === 403 ? 'The AI key was rejected — check the Cloudflare secret.'
          : r.status === 402 ? 'NVIDIA credits are used up.'
          : r.status === 429 ? 'The AI is busy — try again in a moment.'
          : `The AI service returned an error (${r.status}).`;
        return json({ error: msg }, 502, cors.headers);
      }
      const data = await r.json();
      const content = data?.choices?.[0]?.message?.content;
      let parsed;
      try { parsed = firstJson(content); } catch { return json({ error: 'The AI answer could not be read. Try saying it again.' }, 502, cors.headers); }
      return json(sanitize(parsed, ctx), 200, cors.headers);
    } catch (e) {
      return json({ error: e?.name === 'AbortError' ? 'The AI took too long. Try again.' : 'Could not reach the AI service.' }, 504, cors.headers);
    } finally {
      clearTimeout(timer);
    }
  },
};

// exported for tests
export const _internal = { sanitize, firstJson, systemPrompt };
