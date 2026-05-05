'use client';

import { useState } from 'react';

interface ProductResult {
  name: string;
  brand: string;
  genetics: string;
  price: number;
  unit: string;
  dispensary: string;
  dispensary_rating: number;
  dispensary_url: string;
  orderable: boolean;
}

interface SearchResult {
  ok: boolean;
  error?: string;
  category: string;
  unit: string;
  genetics: string;
  location: { query: string; lat: number; lng: number; resolved: string };
  dispensaries_searched: number;
  total_matches: number;
  results: ProductResult[];
  stats: { min: number; max: number; avg: number; count: number };
  summary: string;
}

const geneticsColor: Record<string, string> = {
  indica: 'text-[#C8A6FF] border-[#C8A6FF]/30 bg-[#C8A6FF]/10',
  sativa: 'text-[#FFB976] border-[#FFB976]/30 bg-[#FFB976]/10',
  hybrid: 'text-[#9DFFB5] border-[#9DFFB5]/30 bg-[#9DFFB5]/10',
};

const categories = [
  'flower',
  'edibles',
  'vape',
  'concentrates',
  'pre-rolls',
  'drinks',
  'tinctures',
  'topicals',
];

const geneticsOptions = ['all', 'indica', 'sativa', 'hybrid'];

export function PriceCompareSearch() {
  const [category, setCategory] = useState('flower');
  const [location, setLocation] = useState('');
  const [genetics, setGenetics] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!location.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const body: Record<string, string> = {
        category,
        location: location.trim(),
      };
      if (genetics !== 'all') body.genetics = genetics;

      const res = await fetch('/api/price-compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || 'Search failed');
        return;
      }
      setResult(data);
    } catch {
      setError('Failed to connect');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="border border-[#22262A] bg-[#111315] rounded-md flex items-center gap-3 px-5 py-4">
          <span className="font-mono text-lg text-[#9DFFB5]">›</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="bg-transparent outline-none text-sm font-mono text-[#F1F1EE] cursor-pointer pr-2 border-r border-[#22262A]"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-[#0B0C0D] text-[#F1F1EE]">
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or address (US only)"
            className="flex-1 bg-transparent outline-none text-lg font-medium text-[#F1F1EE] placeholder-[#4F5354]"
            required
          />
          <button
            type="submit"
            disabled={loading || !location.trim()}
            className="font-mono text-[11px] tracking-[1.4px] px-2.5 py-1 border rounded text-[#9DFFB5] border-[#9DFFB5] disabled:text-[#4F5354] disabled:border-[#22262A] disabled:opacity-60"
          >
            {loading ? 'RUNNING…' : '↵ COMPARE · $0.02'}
          </button>
        </div>
        <div className="flex gap-2 pt-1">
          <span className="font-mono text-[10px] text-[#4F5354] tracking-[1.4px] self-center mr-1.5">
            GENETICS
          </span>
          {geneticsOptions.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenetics(g)}
              className={`px-3 py-1.5 border rounded-full text-xs font-mono transition-colors ${
                genetics === g
                  ? 'border-[#9DFFB5] text-[#9DFFB5] bg-[#9DFFB5]/10'
                  : 'border-[#22262A] text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="mt-6 border border-[#FF7361]/30 bg-[#FF7361]/10 rounded-md px-4 py-3 text-sm text-[#FF7361] font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-5">
          <div className="border border-[#22262A] bg-[#111315] rounded-md p-4">
            <p className="text-sm text-[#F1F1EE] font-mono">{result.summary}</p>
            <p className="mt-2 text-[11px] text-[#4F5354] font-mono">
              {result.location.resolved} · {result.dispensaries_searched} dispensaries
            </p>
          </div>

          {result.stats.count > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-[#9DFFB5]/30 bg-[#9DFFB5]/5 rounded-md p-3 text-center">
                <p className="font-mono text-xl font-bold text-[#9DFFB5] tabular-nums">
                  ${result.stats.min}
                </p>
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px] mt-1">
                  Cheapest
                </p>
              </div>
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3 text-center">
                <p className="font-mono text-xl font-bold text-[#F1F1EE] tabular-nums">
                  ${result.stats.avg}
                </p>
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px] mt-1">
                  Average
                </p>
              </div>
              <div className="border border-[#FF7361]/30 bg-[#FF7361]/5 rounded-md p-3 text-center">
                <p className="font-mono text-xl font-bold text-[#FF7361] tabular-nums">
                  ${result.stats.max}
                </p>
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px] mt-1">
                  Highest
                </p>
              </div>
            </div>
          )}

          {result.results.length === 0 ? (
            <p className="text-sm text-[#8A8E8C] font-mono text-center py-8">
              No {result.category} products found near this location.
            </p>
          ) : (
            <div className="border border-[#22262A] bg-[#111315] rounded-md overflow-hidden">
              <div className="divide-y divide-[#22262A]">
                {result.results.map((item, i) => {
                  const best = i === 0;
                  return (
                    <div
                      key={i}
                      className="p-4"
                      style={{ background: best ? '#142219' : 'transparent' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-[#4F5354]">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <p className="text-sm font-semibold text-[#F1F1EE] leading-snug">
                              {item.name}
                            </p>
                            {best && (
                              <span className="font-mono text-[9px] tracking-[1.4px] text-[#9DFFB5]">
                                ★ BEST
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 ml-7">
                            {item.genetics && item.genetics !== 'unknown' && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[item.genetics] || 'border-[#22262A] text-[#8A8E8C]'}`}
                              >
                                {item.genetics}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-[#8A8E8C]">{item.brand}</span>
                            <span className="text-[10px] font-mono text-[#4F5354]">
                              per {item.unit}
                            </span>
                          </div>
                          <a
                            href={item.dispensary_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-mono text-[#8A8E8C] hover:text-[#9DFFB5] mt-1 ml-7 inline-block"
                          >
                            {item.dispensary} · ★ {item.dispensary_rating}
                          </a>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-base font-bold text-[#9DFFB5] tabular-nums">
                            ${item.price}
                          </span>
                          {item.orderable && (
                            <p className="text-[10px] font-mono text-[#4F5354] mt-0.5">
                              Order online
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
