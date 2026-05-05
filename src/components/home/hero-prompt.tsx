'use client';

import { useState } from 'react';

type Parsed = {
  endpoint: 'strain-finder' | 'price-compare' | 'deal-scout' | 'price-history';
  params: Record<string, unknown>;
  cost: number;
  highlights: { term: string; kind: 'strain' | 'location' | 'price' | 'category' }[];
};

const PRICE: Record<Parsed['endpoint'], number> = {
  'strain-finder': 0.02, 'price-compare': 0.02, 'deal-scout': 0.02,
  'price-history': 0.02,
};

// Cheap regex router — covers ~80% of demo queries deterministically.
// Swap for /api/parse (Claude-backed) when you want full coverage.
function parse(text: string): Parsed | null {
  const t = text.trim();
  if (!t) return null;

  const locM = t.match(/(?:near|in|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:,\s*[A-Z]{2})?)/);
  const location = locM?.[1]?.trim();
  const priceM = t.match(/under\s*\$?(\d+)/i);
  const max = priceM ? Number(priceM[1]) : undefined;

  // deals
  if (/\b(deal|deals|sale|tonight|specials?)\b/i.test(t) && location) {
    return { endpoint: 'deal-scout', params: { location }, cost: PRICE['deal-scout'],
      highlights: [{ term: location, kind: 'location' }] };
  }
  // price history
  if (/\b(dropped|trend|history|over time|this week|last month)\b/i.test(t)) {
    const strainM = t.match(/(?:has |is )?([A-Z][A-Za-z0-9\s]+?)\s+(?:dropped|priced|cheaper)/);
    return { endpoint: 'price-history', params: { strain: strainM?.[1]?.trim() }, cost: PRICE['price-history'],
      highlights: strainM ? [{ term: strainM[1].trim(), kind: 'strain' }] : [] };
  }
  // price compare
  if (/\b(cheapest|compare|prices?)\b/i.test(t) && location) {
    const catM = t.match(/(flower|pre-?rolls?|vapes?|edibles?|carts?|concentrates?)/i);
    return { endpoint: 'price-compare', params: { category: catM?.[1]?.toLowerCase() ?? 'flower', location }, cost: PRICE['price-compare'],
      highlights: [catM && { term: catM[1], kind: 'category' as const }, { term: location, kind: 'location' as const }].filter(Boolean) as Parsed['highlights'] };
  }
  // strain finder (default)
  const strainM = t.match(/(?:find|where (?:can i|is)|get me)\s+([A-Z][A-Za-z0-9\s]+?)(?:\s+(?:near|in|under|$))/) ||
                  t.match(/^([A-Z][A-Za-z0-9\s]+?)(?:\s+(?:near|in|under|$))/);
  if (location || strainM) {
    return {
      endpoint: 'strain-finder',
      params: { strain: strainM?.[1]?.trim(), location, max_price: max },
      cost: PRICE['strain-finder'],
      highlights: [
        strainM && { term: strainM[1].trim(), kind: 'strain' as const },
        location && { term: location, kind: 'location' as const },
        max && { term: `$${max}`, kind: 'price' as const },
      ].filter(Boolean) as Parsed['highlights'],
    };
  }
  return null;
}

type Row = { title: string; subtitle?: string; price?: number };

function extractRows(resp: Record<string, unknown>, endpoint?: Parsed['endpoint']): Row[] {
  if (endpoint === 'strain-finder' && Array.isArray(resp.results)) {
    return (resp.results as Array<Record<string, unknown>>).map((r) => {
      const matches = (r.matches as Array<{ price: number; name: string }>) || [];
      const cheapest = matches.slice().sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];
      return {
        title: (r.dispensary as string) || '—',
        subtitle: cheapest?.name || (r.address as string) || undefined,
        price: cheapest?.price,
      };
    });
  }
  if (endpoint === 'price-compare' && Array.isArray(resp.results)) {
    return (resp.results as Array<Record<string, unknown>>).map((r) => ({
      title: (r.name as string) || '—',
      subtitle: (r.dispensary as string) || undefined,
      price: r.price as number,
    }));
  }
  if (endpoint === 'deal-scout' && Array.isArray(resp.results)) {
    return (resp.results as Array<Record<string, unknown>>).map((r) => {
      const products = (r.deal_products as Array<{ price: number; name: string }>) || [];
      const cheapest = products.slice().sort((a, b) => (a.price || Infinity) - (b.price || Infinity))[0];
      return {
        title: (r.dispensary as string) || '—',
        subtitle: cheapest?.name || (r.address as string) || undefined,
        price: cheapest?.price,
      };
    });
  }
  if (endpoint === 'price-history' && Array.isArray(resp.history)) {
    return (resp.history as Array<Record<string, unknown>>).map((h) => ({
      title: (h.item_name as string) || '—',
      subtitle: (h.dispensary_name as string) || undefined,
      price: (h.price_unit as number) ?? (h.price_eighth as number) ?? (h.price_gram as number),
    }));
  }
  return [];
}

function rowCount(resp: Record<string, unknown>): number {
  if (Array.isArray(resp.results)) return resp.results.length;
  if (Array.isArray(resp.history)) return resp.history.length;
  return 0;
}

function rowLabel(endpoint?: Parsed['endpoint']): string {
  if (endpoint === 'price-compare') return 'products';
  if (endpoint === 'price-history') return 'price points';
  if (endpoint === 'deal-scout') return 'shops';
  return 'menus';
}

const SAMPLES = [
  'find Blue Dream near Denver under $30',
  'cheapest pre-rolls in Phoenix',
  'deals near Las Vegas tonight',
  'has Gelato 42 dropped this week?',
  'compare flower prices in Seattle',
  'find Wedding Cake in Los Angeles',
];

const HL_COLOR: Record<string, string> = {
  strain: '#9DFFB5', location: '#FFB976', price: '#9DFFB5', category: '#7AB8FF',
};

export function HeroPrompt() {
  const [text, setText] = useState(SAMPLES[0]);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const parsed = parse(text);

  async function run() {
    if (!parsed) { setErr('Could not parse — try a different phrasing.'); return; }
    setLoading(true); setErr(null); setResponse(null);
    const start = Date.now();
    try {
      const res = await fetch(`/api/${parsed.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.params),
      });
      const data = await res.json();
      data._client_ms = Date.now() - start;
      setResponse(data);
    } catch (e) {
      setErr('Network error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-9 items-start">
      {/* LEFT */}
      <div>
        <div className="text-[11px] font-mono text-[#9DFFB5] tracking-[1.8px] mb-3.5">
          ↓ ASK WHAT YOUR AGENT WOULD ASK
        </div>
        <h1 className="text-[44px] lg:text-[48px] font-semibold leading-[1.04] tracking-[-1px] m-0">
          Cannabis data, priced like an<br />
          <span className="text-[#9DFFB5]">API call</span>, not a contract.
        </h1>
        <p className="text-base text-[#8A8E8C] mt-3.5 leading-relaxed max-w-[520px]">
          Every dispensary menu, price, and deal — across the US — for $0.02 a query. No keys.
          No subscription. Settled in USDC the moment your agent asks.
        </p>

        {/* prompt input */}
        <form
          onSubmit={(e) => { e.preventDefault(); run(); }}
          className="mt-6 border border-[#22262A] bg-[#111315] rounded-md flex items-center gap-3 px-5 py-4"
        >
          <span className="font-mono text-lg text-[#9DFFB5]">›</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="find Blue Dream near Denver under $30"
            className="flex-1 bg-transparent outline-none text-lg font-medium text-[#F1F1EE] placeholder-[#4F5354]"
          />
          <button
            type="submit"
            disabled={!parsed || loading}
            className={`font-mono text-[11px] tracking-[1.4px] px-2.5 py-1 border rounded
              ${parsed ? 'text-[#9DFFB5] border-[#9DFFB5]' : 'text-[#4F5354] border-[#22262A]'}
              disabled:opacity-50`}
          >
            {loading ? 'RUNNING…' : `↵ RUN · $${(parsed?.cost ?? 0.02).toFixed(2)}`}
          </button>
        </form>

        {/* parse chips */}
        <div className={`mt-3 flex flex-wrap gap-2 text-xs font-mono transition-opacity ${parsed ? 'opacity-100' : 'opacity-25'}`}>
          {parsed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#9DFFB5]/40 bg-[#9DFFB5]/10 rounded">
              <span className="text-[#4F5354]">endpoint</span>
              <span className="text-[#9DFFB5]">/{parsed.endpoint}</span>
            </span>
          )}
          {parsed?.highlights.map((h, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-[#22262A] bg-[#111315] rounded">
              <span className="text-[#4F5354]">{h.kind}</span>
              <span style={{ color: HL_COLOR[h.kind] }}>{h.term}</span>
            </span>
          ))}
        </div>

        {/* sample chips */}
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="font-mono text-[10px] text-[#4F5354] tracking-[1.4px] self-center mr-1.5">OR TRY</span>
          {SAMPLES.slice(1).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setText(s)}
              className="px-3 py-1.5 border border-[#22262A] rounded-full text-xs text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT — response panel */}
      <div className="bg-[#111315] border border-[#22262A] rounded-md overflow-hidden">
        <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[#22262A] bg-[#15181A] font-mono text-[11px]">
          <span className={response ? 'text-[#9DFFB5]' : loading ? 'text-[#FFB976]' : 'text-[#4F5354]'}>
            ● {response ? '200 OK' : loading ? 'CALLING' : 'WAITING'}
          </span>
          <span className="text-[#4F5354]">·</span>
          <span className="text-[#8A8E8C]">
            {response ? `${response._client_ms}ms · ${rowCount(response)} ${rowLabel(parsed?.endpoint)}` : '—'}
          </span>
          <span className="ml-auto text-[#9DFFB5]">
            {response ? `−$${parsed?.cost.toFixed(2) ?? '0.02'} settled` : 'pending'}
          </span>
        </div>

        <div className="p-3.5 min-h-[340px] flex flex-col gap-2">
          {err && <div className="text-xs font-mono text-[#FF7361]">{err}</div>}
          {!response && !loading && (
            <div className="text-xs font-mono text-[#4F5354]">press ↵ to run a real call against /{parsed?.endpoint ?? 'strain-finder'}.</div>
          )}
          {loading && [0,1,2,3].map((i) => (
            <div key={i} className="h-14 rounded border border-[#22262A] bg-[#15181A] animate-pulse" style={{ opacity: 1 - i * 0.18 }} />
          ))}
          {response && extractRows(response, parsed?.endpoint).slice(0, 4).map((row, i) => {
            const best = i === 0;
            return (
              <div
                key={i}
                className="grid items-center gap-3 p-2.5 rounded"
                style={{
                  gridTemplateColumns: '28px 1fr auto auto',
                  background: best ? '#142219' : '#15181A',
                  border: `1px solid ${best ? '#9DFFB555' : '#22262A'}`,
                  animation: 'rowAppear .35s both',
                  animationDelay: `${i * 80}ms`,
                }}
              >
                <span className="font-mono text-[11px] text-[#4F5354]">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{row.title}</div>
                  {row.subtitle ? <div className="text-[11px] text-[#8A8E8C] font-mono mt-0.5 truncate">{row.subtitle}</div> : null}
                </div>
                <span className="font-mono text-lg font-bold" style={{ color: best ? '#9DFFB5' : '#F1F1EE' }}>
                  {row.price ? `$${row.price}` : '—'}
                </span>
                <span className="font-mono text-[9px] tracking-[1.4px]" style={{ color: best ? '#9DFFB5' : '#4F5354' }}>
                  {best && row.price ? '★ MATCH' : ''}
                </span>
              </div>
            );
          })}
          {response && response.summary ? (
            <div className="text-[11px] text-[#8A8E8C] font-mono mt-2">{response.summary as string}</div>
          ) : null}
        </div>
      </div>
      <style>{`@keyframes rowAppear { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}
