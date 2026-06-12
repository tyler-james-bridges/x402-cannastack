'use client';

// Endpoint rate card, enriched with live per-endpoint stats (avg latency +
// call count — latency impresses at any traffic level) and a free $0.00
// discovery row: the machine signal that lets an agent case the dataset
// before spending a cent.

import { useAnalytics } from './use-analytics';

const ROWS: { name: string; price: number; desc: string; href?: string }[] = [
  { name: 'strain-finder', price: 0.02, desc: 'cross-menu strain search', href: '/strain-finder' },
  { name: 'price-compare', price: 0.02, desc: 'category price spread',    href: '/price-compare' },
  { name: 'deal-scout',    price: 0.02, desc: 'active deals nearby',      href: '/deal-scout' },
  { name: 'price-history', price: 0.02, desc: 'price changes over time',  href: '/price-history' },
];

export function RateCard() {
  const analytics = useAnalytics(60_000);
  const byEndpoint = new Map(
    (analytics?.by_endpoint ?? []).map((e) => [e.endpoint, e]),
  );

  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">
        ENDPOINTS · pay per call, settle in usdc
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ROWS.map((r) => {
          const live = byEndpoint.get(r.name);
          const inner = (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[13px] font-semibold text-[#F1F1EE]">{r.name}</span>
                <span className="font-mono text-[13px] text-[#9DFFB5]">${r.price.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-[#8A8E8C] mt-1">{r.desc}</div>
              {live && Number(live.cnt) > 0 ? (
                <div className="text-[11px] font-mono text-[#4F5354] mt-1">
                  avg {Math.round(Number(live.avg_ms))}ms · {Number(live.cnt).toLocaleString()} calls
                </div>
              ) : null}
            </>
          );
          return r.href ? (
            <a key={r.name} href={r.href} className="block border border-[#22262A] hover:border-[#9DFFB5]/40 px-3.5 py-3 rounded bg-[#111315] transition-colors">
              {inner}
            </a>
          ) : (
            <div key={r.name} className="border border-[#22262A] px-3.5 py-3 rounded bg-[#111315]">
              {inner}
            </div>
          );
        })}
        <a
          href="/api/crawl/status"
          className="block border border-[#22262A] hover:border-[#7AB8FF]/40 px-3.5 py-3 rounded bg-[#111315] transition-colors"
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-[13px] font-semibold text-[#F1F1EE]">discovery</span>
            <span className="font-mono text-[13px] text-[#7AB8FF]">$0.00</span>
          </div>
          <div className="text-[11px] text-[#8A8E8C] mt-1">
            GET /api/crawl/status — index stats, metros, freshness. free.
          </div>
        </a>
      </div>
    </div>
  );
}
