'use client';

import { useState } from 'react';

interface Match {
  name: string;
  category: string;
  brand: string;
  genetics: string;
  price: number;
  orderable: boolean;
}

interface DispensaryResult {
  dispensary: string;
  rating: number;
  reviews: number;
  type: string;
  address: string;
  city: string;
  url: string;
  matches: Match[];
}

interface SearchResult {
  ok: boolean;
  error?: string;
  strain: string;
  location: { query: string; lat: number; lng: number; resolved: string };
  dispensaries_searched: number;
  results: DispensaryResult[];
  summary: string;
}

const geneticsColor: Record<string, string> = {
  indica: 'text-[#C8A6FF] border-[#C8A6FF]/30 bg-[#C8A6FF]/10',
  sativa: 'text-[#FFB976] border-[#FFB976]/30 bg-[#FFB976]/10',
  hybrid: 'text-[#9DFFB5] border-[#9DFFB5]/30 bg-[#9DFFB5]/10',
};

const exampleStrains = ['Blue Dream', 'Gelato', 'OG Kush', 'Wedding Cake', 'Girl Scout Cookies'];

export function StrainFinderSearch() {
  const [strain, setStrain] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!strain.trim() || !location.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch('/api/strain-finder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strain: strain.trim(), location: location.trim() }),
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
            value={strain}
            onChange={(e) => setStrain(e.target.value)}
            placeholder="Strain name (e.g. Blue Dream)"
            className="flex-1 bg-transparent outline-none text-lg font-medium text-[#F1F1EE] placeholder-[#4F5354]"
            required
          />
          <button
            type="submit"
            disabled={loading || !strain.trim() || !location.trim()}
            className="font-mono text-[11px] tracking-[1.4px] px-2.5 py-1 border rounded text-[#9DFFB5] border-[#9DFFB5] disabled:text-[#4F5354] disabled:border-[#22262A] disabled:opacity-60"
          >
            {loading ? 'RUNNING…' : '↵ FIND · $0.02'}
          </button>
        </div>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City or address (US only)"
          className="w-full border border-[#22262A] bg-[#111315] rounded-md px-4 py-3 font-mono text-sm text-[#F1F1EE] placeholder-[#4F5354] outline-none focus:border-[#4F5354]"
          required
        />
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="font-mono text-[10px] text-[#4F5354] tracking-[1.4px] self-center mr-1.5">
            OR TRY
          </span>
          {exampleStrains.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrain(s)}
              className="px-3 py-1.5 border border-[#22262A] rounded-full text-xs text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]"
            >
              {s}
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
              {result.location.resolved} · {result.dispensaries_searched} menus searched
            </p>
          </div>

          {result.results.length === 0 ? (
            <p className="text-sm text-[#8A8E8C] font-mono text-center py-8">
              No dispensaries carry &quot;{result.strain}&quot; near this location. Try a different
              strain or expand your search area.
            </p>
          ) : (
            result.results.map((disp, i) => {
              const best = i === 0;
              return (
                <div
                  key={i}
                  className="rounded-md overflow-hidden"
                  style={{
                    background: best ? '#142219' : '#111315',
                    border: `1px solid ${best ? '#9DFFB555' : '#22262A'}`,
                  }}
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
                          {best && (
                            <span className="font-mono text-[9px] tracking-[1.4px] text-[#9DFFB5]">
                              ★ BEST PRICE
                            </span>
                          )}
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
                      <span className="text-[11px] font-mono text-[#9DFFB5] shrink-0">
                        {disp.matches.length} match{disp.matches.length !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-[#22262A]">
                    {disp.matches.map((match, j) => (
                      <div key={j} className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#F1F1EE] leading-snug">
                              {match.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#22262A] text-[#8A8E8C]">
                                {match.category}
                              </span>
                              {match.genetics && match.genetics !== 'unknown' && (
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[match.genetics] || 'border-[#22262A] text-[#8A8E8C]'}`}
                                >
                                  {match.genetics}
                                </span>
                              )}
                              <span className="text-[11px] font-mono text-[#8A8E8C]">
                                {match.brand}
                              </span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {match.price > 0 && (
                              <span className="font-mono text-base font-bold text-[#9DFFB5] tabular-nums">
                                ${match.price}
                              </span>
                            )}
                            {match.orderable && (
                              <p className="text-[10px] font-mono text-[#4F5354] mt-0.5">
                                Order online
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
