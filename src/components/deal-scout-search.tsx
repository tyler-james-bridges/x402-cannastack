'use client';

import { useState } from 'react';

interface DealProduct {
  name: string;
  category: string;
  brand: string;
  genetics: string;
  price: number;
  orderable: boolean;
}

interface DealResult {
  dispensary: string;
  rating: number;
  reviews: number;
  type: string;
  address: string;
  city: string;
  url: string;
  deal_products: DealProduct[];
}

interface SearchResult {
  ok: boolean;
  error?: string;
  location: { query: string; lat: number; lng: number; resolved: string };
  category: string;
  total_dispensaries: number;
  deals_dispensaries: number;
  results: DealResult[];
  summary: string;
}

const geneticsColor: Record<string, string> = {
  indica: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  sativa: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  hybrid: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const categoryOptions = [
  { value: '', label: 'All categories' },
  { value: 'flower', label: 'Flower' },
  { value: 'edibles', label: 'Edibles' },
  { value: 'vape', label: 'Vape Pens' },
  { value: 'concentrates', label: 'Concentrates' },
  { value: 'pre-rolls', label: 'Pre-Rolls' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'tinctures', label: 'Tinctures' },
  { value: 'topicals', label: 'Topicals' },
];

export function DealScoutSearch() {
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('');
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
      const body: Record<string, string> = { location: location.trim() };
      if (category) body.category = category;

      const res = await fetch('/api/deal-scout', {
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
            {loading ? 'Scouting...' : 'Scout'}
          </button>
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white outline-none focus:border-white/30 transition-colors appearance-none cursor-pointer"
        >
          {categoryOptions.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-black text-white">
              {opt.label}
            </option>
          ))}
        </select>
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
              {result.location.resolved}
            </p>
          </div>

          {result.deals_dispensaries > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3 text-center">
                <p className="text-lg font-mono font-bold text-yellow-400">
                  {result.deals_dispensaries}
                </p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  With deals
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-center">
                <p className="text-lg font-mono font-bold text-white/70">
                  {result.total_dispensaries}
                </p>
                <p className="text-[10px] font-mono text-white/40 uppercase tracking-wider">
                  Total nearby
                </p>
              </div>
            </div>
          )}

          {result.results.length === 0 ? (
            <p className="text-sm text-white/40 font-mono text-center py-8">
              No dispensaries with active deals found near this location.
            </p>
          ) : (
            result.results.map((disp, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
              >
                <div className="p-4 border-b border-white/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={disp.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-base font-bold font-mono text-white hover:text-white/80 transition-colors"
                      >
                        {disp.dispensary}
                      </a>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className="text-[11px] font-mono text-yellow-400">
                          {'*'.repeat(Math.round(disp.rating))} {disp.rating}
                        </span>
                        <span className="text-[11px] font-mono text-white/30">
                          ({disp.reviews} reviews)
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-yellow-500/20 text-yellow-400/60 uppercase">
                          Deals
                        </span>
                      </div>
                      {disp.address && (
                        <p className="text-[11px] text-white/25 font-mono mt-1">
                          {disp.address}, {disp.city}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {disp.deal_products.length > 0 ? (
                  <div className="divide-y divide-white/5">
                    {disp.deal_products.map((prod, j) => (
                      <div key={j} className="p-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-mono font-bold text-white/90 leading-snug">
                              {prod.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/40">
                                {prod.category}
                              </span>
                              {prod.genetics && prod.genetics !== 'unknown' && (
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[prod.genetics] || 'border-white/10 text-white/40'}`}
                                >
                                  {prod.genetics}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-white/30">
                                {prod.brand}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {prod.price > 0 && (
                              <span className="text-sm font-mono font-bold text-green-400">
                                ${prod.price}
                              </span>
                            )}
                            {prod.orderable && (
                              <p className="text-[10px] font-mono text-white/30 mt-0.5">
                                Order online
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4">
                    <p className="text-[11px] text-white/30 font-mono">
                      This dispensary has active deals. Visit their page for details.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}

          <div className="rounded-lg border border-white/5 bg-white/[0.01] p-4 text-center">
            <p className="text-[11px] text-white/25 font-mono">
              Powered by cannastack. Sale flags from source data; individual sale prices may not be
              available. Full API: $0.02/req via x402.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
