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
  up: { arrow: '↑', color: 'text-[#FF7361]' },
  down: { arrow: '↓', color: 'text-[#9DFFB5]' },
  stable: { arrow: '·', color: 'text-[#8A8E8C]' },
};

function formatPrice(point: PricePoint): string {
  const p = Number(point.price_unit) || Number(point.price_eighth) || Number(point.price_gram);
  return p > 0 ? `$${p}` : '—';
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
        {(['strain', 'dispensary'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`font-mono text-xs tracking-[1.4px] px-3 py-1.5 border rounded ${
              mode === m
                ? 'border-[#9DFFB5] text-[#9DFFB5] bg-[#9DFFB5]/10'
                : 'border-[#22262A] text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]'
            }`}
          >
            BY {m.toUpperCase()}
          </button>
        ))}
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <div className="border border-[#22262A] bg-[#111315] rounded-md flex items-center gap-3 px-5 py-4">
          <span className="font-mono text-lg text-[#9DFFB5]">›</span>
          {mode === 'strain' ? (
            <input
              type="text"
              value={strain}
              onChange={(e) => setStrain(e.target.value)}
              placeholder="Strain name (e.g. Blue Dream)"
              className="flex-1 bg-transparent outline-none text-lg font-medium text-[#F1F1EE] placeholder-[#4F5354]"
            />
          ) : (
            <input
              type="text"
              value={dispensary}
              onChange={(e) => setDispensary(e.target.value)}
              placeholder="Dispensary name (e.g. JARS Cannabis)"
              className="flex-1 bg-transparent outline-none text-lg font-medium text-[#F1F1EE] placeholder-[#4F5354]"
            />
          )}
          <button
            type="submit"
            disabled={loading}
            className="font-mono text-[11px] tracking-[1.4px] px-2.5 py-1 border rounded text-[#9DFFB5] border-[#9DFFB5] disabled:text-[#4F5354] disabled:border-[#22262A] disabled:opacity-60"
          >
            {loading ? 'RUNNING…' : '↵ SEARCH · $0.02'}
          </button>
        </div>

        {mode === 'dispensary' && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full border border-[#22262A] bg-[#111315] rounded-md px-4 py-3 font-mono text-sm text-[#F1F1EE] outline-none focus:border-[#4F5354]"
          >
            <option value="" className="bg-[#0B0C0D]">All categories</option>
            <option value="flower" className="bg-[#0B0C0D]">Flower</option>
            <option value="edibles" className="bg-[#0B0C0D]">Edibles</option>
            <option value="vape pens" className="bg-[#0B0C0D]">Vape Pens</option>
            <option value="concentrates" className="bg-[#0B0C0D]">Concentrates</option>
            <option value="pre-rolls" className="bg-[#0B0C0D]">Pre-Rolls</option>
            <option value="drinks" className="bg-[#0B0C0D]">Drinks</option>
            <option value="tinctures" className="bg-[#0B0C0D]">Tinctures</option>
          </select>
        )}

        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Location (optional, narrows to nearby dispensaries)"
          className="w-full border border-[#22262A] bg-[#111315] rounded-md px-4 py-3 font-mono text-sm text-[#F1F1EE] placeholder-[#4F5354] outline-none focus:border-[#4F5354]"
        />

        <div className="flex gap-2 pt-1">
          <span className="font-mono text-[10px] text-[#4F5354] tracking-[1.4px] self-center mr-1.5">
            WINDOW
          </span>
          {['7', '14', '30', '90'].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 py-1.5 border rounded-full text-xs font-mono ${
                days === d
                  ? 'border-[#9DFFB5] text-[#9DFFB5] bg-[#9DFFB5]/10'
                  : 'border-[#22262A] text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]'
              }`}
            >
              {d}d
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
          </div>

          {result.stats && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3">
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px]">
                  Current
                </p>
                <p className="font-mono text-xl font-bold text-[#9DFFB5] tabular-nums mt-1">
                  ${result.stats.current}
                </p>
              </div>
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3">
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px]">
                  {result.query.days}d ago
                </p>
                <p className="font-mono text-xl font-bold text-[#F1F1EE] tabular-nums mt-1">
                  ${result.stats.oldest}
                </p>
              </div>
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3">
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px]">
                  Change
                </p>
                <p
                  className={`font-mono text-xl font-bold tabular-nums mt-1 ${
                    result.stats.change_pct > 0
                      ? 'text-[#FF7361]'
                      : result.stats.change_pct < 0
                        ? 'text-[#9DFFB5]'
                        : 'text-[#8A8E8C]'
                  }`}
                >
                  {result.stats.change_pct > 0 ? '+' : ''}
                  {result.stats.change_pct}%
                </p>
              </div>
              <div className="border border-[#22262A] bg-[#111315] rounded-md p-3">
                <p className="text-[10px] font-mono text-[#4F5354] uppercase tracking-[1.4px]">
                  Trend
                </p>
                <p
                  className={`font-mono text-xl font-bold mt-1 ${trendIndicator[result.stats.trend].color}`}
                >
                  {trendIndicator[result.stats.trend].arrow} {result.stats.trend}
                </p>
              </div>
            </div>
          )}

          {result.history.length === 0 ? (
            <p className="text-sm text-[#8A8E8C] font-mono text-center py-8">
              No price changes recorded for this query.
            </p>
          ) : (
            <div className="border border-[#22262A] bg-[#111315] rounded-md overflow-hidden">
              <div className="divide-y divide-[#22262A]">
                {result.history.map((point, i) => {
                  const price = formatPrice(point);
                  const prevPoint = result.history[i + 1];
                  let changeStr = '';
                  let changeColor = 'text-[#4F5354]';

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
                        changeStr = `↑ +${diff}%`;
                        changeColor = 'text-[#FF7361]';
                      } else if (diff < 0) {
                        changeStr = `↓ ${diff}%`;
                        changeColor = 'text-[#9DFFB5]';
                      }
                    }
                  }

                  return (
                    <div key={i} className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#F1F1EE]">{point.item_name}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[11px] font-mono text-[#8A8E8C]">
                              {point.dispensary_name}
                            </span>
                            {point.brand && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#22262A] text-[#8A8E8C]">
                                {point.brand}
                              </span>
                            )}
                            <span className="text-[10px] font-mono text-[#4F5354]">
                              {formatDate(point.recorded_at)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono text-base font-bold text-[#9DFFB5] tabular-nums">
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
        </div>
      )}
    </div>
  );
}
