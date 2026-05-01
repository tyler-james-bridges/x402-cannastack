'use client';

import { useState } from 'react';

interface PricePoint {
  item_name: string;
  brand: string;
  category: string;
  dispensary_name: string;
  price_unit: number | null;
  price_eighth: number | null;
  price_gram: number | null;
  recorded_at: string;
}

interface Stats {
  current: number;
  oldest: number;
  change_pct: number;
  trend: 'up' | 'down' | 'stable';
  data_points: number;
}

interface SearchResult {
  ok: boolean;
  error?: string;
  query: {
    strain: string | null;
    dispensary: string | null;
    category: string | null;
    days: number;
    location: string | null;
  };
  history: PricePoint[];
  stats: Stats | null;
  summary: string;
}

const trendIndicator: Record<string, { arrow: string; color: string }> = {
  up: { arrow: '^', color: 'text-red-400' },
  down: { arrow: 'v', color: 'text-green-400' },
  stable: { arrow: '-', color: 'text-white/40' },
};

function formatPrice(point: PricePoint): string {
  const p = Number(point.price_unit) || Number(point.price_eighth) || Number(point.price_gram);
  return p > 0 ? `$${p}` : '--';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PriceHistorySearch() {
  const [mode, setMode] = useState<'strain' | 'dispensary'>('strain');
  const [strain, setStrain] = useState('');
  const [dispensary, setDispensary] = useState('');
  const [category, setCategory] = useState('');
  const [location, setLocation] = useState('');
  const [days, setDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    const payload: Record<string, string> = { days };
    if (mode === 'strain') {
      if (!strain.trim()) {
        setError('Enter a strain name');
        setLoading(false);
        return;
      }
      payload.strain = strain.trim();
    } else {
      if (!dispensary.trim()) {
        setError('Enter a dispensary name');
        setLoading(false);
        return;
      }
      payload.dispensary = dispensary.trim();
      if (category) payload.category = category;
    }
    if (location.trim()) payload.location = location.trim();

    try {
      const res = await fetch('/api/price-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('strain')}
          className={`rounded-lg px-4 py-2 font-mono text-sm transition-colors ${
            mode === 'strain'
              ? 'bg-white text-black font-bold'
              : 'border border-white/20 text-white/50 hover:text-white/80'
          }`}
        >
          By Strain
        </button>
        <button
          type="button"
          onClick={() => setMode('dispensary')}
          className={`rounded-lg px-4 py-2 font-mono text-sm transition-colors ${
            mode === 'dispensary'
              ? 'bg-white text-black font-bold'
              : 'border border-white/20 text-white/50 hover:text-white/80'
          }`}
        >
          By Dispensary
        </button>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        {mode === 'strain' ? (
          <input
            type="text"
            value={strain}
            onChange={(e) => setStrain(e.target.value)}
            placeholder="Strain name (e.g. Blue Dream)"
            className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:border-white/40 transition-colors"
          />
        ) : (
          <>
            <input
              type="text"
              value={dispensary}
              onChange={(e) => setDispensary(e.target.value)}
              placeholder="Dispensary name (e.g. JARS Cannabis)"
              className="w-full rounded-lg border border-white/20 bg-white/5 px-4 py-3 font-mono text-sm text-white placeholder-white/30 outline-none focus:border-white/40 transition-colors"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white/70 outline-none focus:border-white/30 transition-colors"
            >
              <option value="">All categories</option>
              <option value="flower">Flower</option>
              <option value="edibles">Edibles</option>
              <option value="vape pens">Vape Pens</option>
              <option value="concentrates">Concentrates</option>
              <option value="pre-rolls">Pre-Rolls</option>
              <option value="drinks">Drinks</option>
              <option value="tinctures">Tinctures</option>
            </select>
          </>
        )}

        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional, narrows to nearby dispensaries)"
          className="w-full rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white placeholder-white/20 outline-none focus:border-white/30 transition-colors"
        />

        <div className="flex gap-3">
          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-2.5 font-mono text-sm text-white/70 outline-none focus:border-white/30 transition-colors"
          >
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>

          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-white px-6 py-2.5 font-mono text-sm font-bold text-black hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search Price History'}
          </button>
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
          </div>

          {result.stats && (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
              <h3 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-4">
                Stats
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-mono text-white/30">Current</p>
                  <p className="text-lg font-mono font-bold text-green-400">
                    ${result.stats.current}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-white/30">
                    {result.query.days}d ago
                  </p>
                  <p className="text-lg font-mono font-bold text-white/60">
                    ${result.stats.oldest}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-white/30">Change</p>
                  <p
                    className={`text-lg font-mono font-bold ${
                      result.stats.change_pct > 0
                        ? 'text-red-400'
                        : result.stats.change_pct < 0
                          ? 'text-green-400'
                          : 'text-white/40'
                    }`}
                  >
                    {result.stats.change_pct > 0 ? '+' : ''}
                    {result.stats.change_pct}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-mono text-white/30">Trend</p>
                  <p
                    className={`text-lg font-mono font-bold ${trendIndicator[result.stats.trend].color}`}
                  >
                    {trendIndicator[result.stats.trend].arrow} {result.stats.trend}
                  </p>
                </div>
              </div>
            </div>
          )}

          {result.history.length === 0 ? (
            <p className="text-sm text-white/40 font-mono text-center py-8">
              No price changes recorded for this query.
            </p>
          ) : (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
              <div className="divide-y divide-white/5">
                {result.history.map((point, i) => {
                  const price = formatPrice(point);
                  const prevPoint = result.history[i + 1];
                  let changeStr = '';
                  let changeColor = 'text-white/30';

                  if (prevPoint) {
                    const curr =
                      Number(point.price_unit) ||
                      Number(point.price_eighth) ||
                      Number(point.price_gram) ||
                      0;
                    const prev =
                      Number(prevPoint.price_unit) ||
                      Number(prevPoint.price_eighth) ||
                      Number(prevPoint.price_gram) ||
                      0;
                    if (curr > 0 && prev > 0) {
                      const diff = Math.round(((curr - prev) / prev) * 10000) / 100;
                      if (diff > 0) {
                        changeStr = `^ +${diff}%`;
                        changeColor = 'text-red-400';
                      } else if (diff < 0) {
                        changeStr = `v ${diff}%`;
                        changeColor = 'text-green-400';
                      }
                    }
                  }

                  return (
                    <div key={i} className="p-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-mono font-bold text-white/90">
                            {point.item_name}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-white/30">
                              {point.dispensary_name}
                            </span>
                            {point.brand && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-white/40">
                                {point.brand}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-white/20">
                              {formatDate(point.recorded_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-sm font-mono font-bold text-green-400">
                            {price}
                          </span>
                          {changeStr && (
                            <p className={`text-[10px] font-mono mt-0.5 ${changeColor}`}>
                              {changeStr}
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
