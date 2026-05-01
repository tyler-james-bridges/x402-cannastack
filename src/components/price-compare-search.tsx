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
  indica: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  sativa: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  hybrid: 'bg-green-500/20 text-green-300 border-green-500/30',
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
        <div className="flex gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none focus:border-white/40 transition-colors appearance-none cursor-pointer"
          >
            {categories.map((c) => (
              <option key={c} value={c} className="bg-black text-white">
                {c}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City or address (US only)"
            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:border-white/40 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-white px-6 py-3 font-mono text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? 'Comparing...' : 'Compare'}
          </button>
        </div>
        <div className="flex gap-2">
          {geneticsOptions.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGenetics(g)}
              className={`rounded-full border px-3 py-1 font-mono text-[11px] transition-colors ${
                genetics === g
                  ? 'border-white/40 text-white bg-white/10'
                  : 'border-white/10 text-white/40 bg-white/[0.03] hover:text-white/70 hover:border-white/20'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-mono">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-8 space-y-6">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
            <p className="text-sm text-white/60 font-mono">{result.summary}</p>
            <p className="mt-2 text-[11px] text-white/30 font-mono">
              {result.location.resolved} | {result.dispensaries_searched} dispensaries
            </p>
          </div>

          {result.stats.count > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-3 text-center">
                <p className="text-lg font-mono font-bold text-green-400">
                  ${result.stats.min}
                </p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Cheapest
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <p className="text-lg font-mono font-bold text-white/70">
                  ${result.stats.avg}
                </p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Average
                </p>
              </div>
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-center">
                <p className="text-lg font-mono font-bold text-red-400">
                  ${result.stats.max}
                </p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Highest
                </p>
              </div>
            </div>
          )}

          {result.results.length === 0 ? (
            <p className="text-sm text-white/40 font-mono text-center py-8">
              No {result.category} products found near this location.
            </p>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="divide-y divide-white/5">
                {result.results.map((item, i) => (
                  <div key={i} className="p-4 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-mono font-bold text-white/90 leading-snug">
                          {item.name}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          {item.genetics && item.genetics !== 'unknown' && (
                            <span
                              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[item.genetics] || 'border-white/10 text-white/40'}`}
                            >
                              {item.genetics}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-white/30">{item.brand}</span>
                          <span className="text-[10px] font-mono text-white/20">
                            per {item.unit}
                          </span>
                        </div>
                        <a
                          href={item.dispensary_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-white/25 hover:text-white/50 transition-colors mt-1 inline-block"
                        >
                          {item.dispensary} ({item.dispensary_rating} stars)
                        </a>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-mono font-bold text-green-400">
                          ${item.price}
                        </span>
                        {item.orderable && (
                          <p className="text-[10px] font-mono text-white/30 mt-0.5">
                            Order online
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4 text-center">
            <p className="text-[11px] text-white/25 font-mono">
              Powered by cannastack. Full API: $0.02/req via x402.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
