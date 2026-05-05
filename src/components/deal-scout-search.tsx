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
  indica: 'text-[#C8A6FF] border-[#C8A6FF]/30 bg-[#C8A6FF]/10',
  sativa: 'text-[#FFB976] border-[#FFB976]/30 bg-[#FFB976]/10',
  hybrid: 'text-[#9DFFB5] border-[#9DFFB5]/30 bg-[#9DFFB5]/10',
};

const categoryOptions = [
  { value: '', label: 'all categories' },
  { value: 'flower', label: 'flower' },
  { value: 'edibles', label: 'edibles' },
  { value: 'vape', label: 'vape' },
  { value: 'concentrates', label: 'concentrates' },
  { value: 'pre-rolls', label: 'pre-rolls' },
  { value: 'drinks', label: 'drinks' },
  { value: 'tinctures', label: 'tinctures' },
  { value: 'topicals', label: 'topicals' },
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
        <div className="border border-[#22262A] bg-[#111315] rounded-md flex items-center gap-3 px-5 py-4">
          <span className="font-mono text-lg text-[#9DFFB5]">›</span>
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
            {loading ? 'RUNNING…' : '↵ SCOUT · $0.02'}
          </button>
        </div>
        <div className="flex gap-2 flex-wrap pt-1">
          <span className="font-mono text-[10px] text-[#4F5354] tracking-[1.4px] self-center mr-1.5">
            CATEGORY
          </span>
          {categoryOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setCategory(opt.value)}
              className={`px-3 py-1.5 border rounded-full text-xs font-mono transition-colors ${
                category === opt.value
                  ? 'border-[#9DFFB5] text-[#9DFFB5] bg-[#9DFFB5]/10'
                  : 'border-[#22262A] text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]'
              }`}
            >
              {opt.label}
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
            <p className="mt-2 text-[11px] text-[#4F5354] font-mono">{result.location.resolved}</p>
          </div>

          {result.deals_dispensaries > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#FFB976]/30 bg-[#FFB976]/5 rounded-md p-3 text-center">
                <p className="font-mono text-xl font-bold text-[#FFB976] tabular-nums">
                  {result.deals_dispensaries}
                </p>
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px] mt-1">
                  With deals
                </p>
              </div>
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3 text-center">
                <p className="font-mono text-xl font-bold text-[#F1F1EE] tabular-nums">
                  {result.total_dispensaries}
                </p>
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px] mt-1">
                  Total nearby
                </p>
              </div>
            </div>
          )}

          {result.results.length === 0 ? (
            <p className="text-sm text-[#8A8E8C] font-mono text-center py-8">
              No dispensaries with active deals found near this location.
            </p>
          ) : (
            result.results.map((disp, i) => (
              <div
                key={i}
                className="border border-[#22262A] bg-[#111315] rounded-md overflow-hidden"
              >
                <div className="p-4 border-b border-[#22262A]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[11px] text-[#4F5354]">
                          {String(i + 1).padStart(2, '0')}
                        </span>
                        <a
                          href={disp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base font-semibold text-[#F1F1EE] hover:text-[#9DFFB5]"
                        >
                          {disp.dispensary}
                        </a>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#FFB976]/30 bg-[#FFB976]/10 text-[#FFB976] tracking-[1.4px]">
                          DEALS
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 ml-7">
                        <span className="text-[11px] font-mono text-[#FFB976]">
                          ★ {disp.rating}
                        </span>
                        <span className="text-[11px] font-mono text-[#4F5354]">
                          ({disp.reviews} reviews)
                        </span>
                        {disp.address && (
                          <span className="text-[11px] text-[#8A8E8C] font-mono">
                            · {disp.address}, {disp.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {disp.deal_products.length > 0 ? (
                  <div className="divide-y divide-[#22262A]">
                    {disp.deal_products.map((prod, j) => (
                      <div key={j} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#F1F1EE] leading-snug">
                              {prod.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#22262A] text-[#8A8E8C]">
                                {prod.category}
                              </span>
                              {prod.genetics && prod.genetics !== 'unknown' && (
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[prod.genetics] || 'border-[#22262A] text-[#8A8E8C]'}`}
                                >
                                  {prod.genetics}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-[#8A8E8C]">
                                {prod.brand}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {prod.price > 0 && (
                              <span className="font-mono text-base font-bold text-[#9DFFB5] tabular-nums">
                                ${prod.price}
                              </span>
                            )}
                            {prod.orderable && (
                              <p className="text-[10px] font-mono text-[#4F5354] mt-0.5">
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
                    <p className="text-[11px] text-[#8A8E8C] font-mono">
                      Active deals on this menu. Visit the dispensary page for specifics.
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
