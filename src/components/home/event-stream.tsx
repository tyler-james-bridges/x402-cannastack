// src/components/home/event-stream.tsx
// The ledger: one time-sorted feed merging crawler runs (free work that
// builds the index) with paid queries. At low traffic the crawl rows keep it
// honest and alive — the machine is working even when nobody's paying yet.

'use client';

import { useAnalytics } from './use-analytics';
import { useCrawlStatus } from './use-crawl-status';
import { PRICE_USDC } from '@/lib/analytics-types';

function ago(ts: string) {
  const ms = Date.now() - new Date(ts).getTime();
  const s = ms / 1000;
  if (s < 1) return 'now';
  if (s < 60) return `-${Math.floor(s)}s`;
  if (s < 3600) return `-${Math.floor(s / 60)}m`;
  if (s < 86400) return `-${Math.floor(s / 3600)}h`;
  if (s < 172800) return 'yesterday';
  // Absolute date beats a stale "-22d" row screaming neglect.
  return new Date(ts)
    .toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
    .toLowerCase();
}

type LedgerRow = {
  ts: string;
  glyph: string;
  glyphColor: string;
  text: string;
  detail?: string;
  right: string;
  rightColor: string;
};

export function EventStream() {
  const analytics = useAnalytics(5000);
  const crawl = useCrawlStatus(60_000);

  const paidRows: LedgerRow[] = (analytics?.recent ?? []).map((e) => ({
    ts: e.created_at,
    glyph: '▸',
    glyphColor: '#9DFFB5',
    text: `POST /${e.endpoint}`,
    detail: [e.location_query, e.response_ms != null ? `${e.response_ms}ms` : null]
      .filter(Boolean)
      .join(' · '),
    right: `−$${(PRICE_USDC[e.endpoint] ?? 0.02).toFixed(2)}`,
    rightColor: '#9DFFB5',
  }));

  const crawlRows: LedgerRow[] = (crawl?.recentCrawls ?? [])
    .filter((c) => c.status === 'success' && c.completed_at)
    .map((c) => ({
      ts: c.completed_at!,
      glyph: '◆',
      glyphColor: '#7AB8FF',
      text: `crawl ${c.metro_name.split(',')[0].toLowerCase()}`,
      detail: `${(c.items_loaded ?? 0).toLocaleString()} items · ${c.items_updated ?? 0} updated`,
      right: 'free',
      rightColor: '#4F5354',
    }));

  const rows = [...paidRows, ...crawlRows]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 12);

  return (
    <div className="flex flex-col min-w-0">
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">
        LEDGER · tail -f
      </div>
      <div className="flex-1 overflow-hidden relative min-h-[280px]">
        <div className="absolute inset-0 overflow-y-auto">
          {rows.length === 0 && (
            <div className="text-xs font-mono text-[#4F5354] py-2">
              index warming up · first crawl pending
            </div>
          )}
          {rows.map((r, i) => (
            <div
              key={`${r.ts}-${r.text}-${i}`}
              className="grid items-center py-1.5 border-b border-[#22262A] text-xs font-mono gap-1.5 sm:gap-2 grid-cols-[44px_12px_minmax(0,1fr)_44px] sm:grid-cols-[64px_14px_minmax(0,1fr)_52px]"
              style={{
                opacity: i === 0 ? 1 : Math.max(0.32, 1 - i * 0.04),
              }}
            >
              <span className={i === 0 ? 'text-[#9DFFB5]' : 'text-[#4F5354]'}>{ago(r.ts)}</span>
              <span style={{ color: r.glyphColor }}>{r.glyph}</span>
              <span className="text-[#F1F1EE] truncate">
                {r.text}
                {r.detail ? <span className="text-[#4F5354]"> · {r.detail}</span> : null}
              </span>
              <span className="text-right" style={{ color: r.rightColor }}>
                {r.right}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
