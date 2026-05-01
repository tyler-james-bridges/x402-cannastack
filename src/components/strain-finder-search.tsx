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
  indica: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  sativa: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  hybrid: 'bg-green-500/20 text-green-300 border-green-500/30',
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
        <div className="flex gap-3">
          <input
            type="text"
            value={strain}
            onChange={(e) => setStrain(e.target.value)}
            placeholder="Strain name (e.g. Blue Dream)"
            className="flex-1 rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:border-white/40 transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-white px-6 py-3 font-mono text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {loading ? 'Searching...' : 'Find'}
          </button>
        </div>
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="City or address (US only)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
          required
        />
        <div className="flex flex-wrap gap-2">
          {exampleStrains.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStrain(s)}
              className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-white/40 hover:text-white/70 hover:border-white/20 transition-colors"
            >
              {s}
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
              {result.location.resolved} | {result.dispensaries_searched} menus searched
            </p>
          </div>

          {result.results.length === 0 ? (
            <p className="text-sm text-white/40 font-mono text-center py-8">
              No dispensaries carry &quot;{result.strain}&quot; near this location. Try a different
              strain or expand your search area.
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
                      </div>
                      {disp.address && (
                        <p className="text-[11px] text-white/25 font-mono mt-1">
                          {disp.address}, {disp.city}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-green-400 shrink-0">
                      {disp.matches.length} match{disp.matches.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>

                <div className="divide-y divide-white/5">
                  {disp.matches.map((match, j) => (
                    <div key={j} className="p-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono font-bold text-white/90 leading-snug">
                            {match.name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/40">
                              {match.category}
                            </span>
                            {match.genetics && match.genetics !== 'unknown' && (
                              <span
                                className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${geneticsColor[match.genetics] || 'border-white/10 text-white/40'}`}
                              >
                                {match.genetics}
                              </span>
                            )}
                            <span className="text-[11px] font-mono text-white/30">
                              {match.brand}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {match.price > 0 && (
                            <span className="text-sm font-mono font-bold text-green-400">
                              ${match.price}
                            </span>
                          )}
                          {match.orderable && (
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
            ))
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
