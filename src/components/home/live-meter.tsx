// src/components/home/live-meter.tsx
// Honest meters, no theater. The old 64px animated 24h counter (with its
// random-drift ticker) is gone: at low volume it read as a ghost town, and a
// simulated tick is the kind of thing that torches trust when noticed.
//
// - LiveMeter (top status strips): index size + crawl freshness.
// - MeterStrip (below the index band): all-time unit economics. Cumulative
//   numbers only go up; a 24h figure resets to embarrassing daily.

'use client';

import { useAnalytics } from './use-analytics';
import { useCrawlStatus } from './use-crawl-status';
import { PRICE_USDC } from '@/lib/analytics-types';

function crawledAgo(lastCrawl: string | null | undefined): string {
  if (!lastCrawl) return '—';
  const h = (Date.now() - new Date(lastCrawl).getTime()) / 3_600_000;
  if (h < 1) return `${Math.max(1, Math.floor(h * 60))}m ago`;
  return `${Math.floor(h)}h ago`;
}

export function LiveMeter({ className = '' }: { variant?: 'hero' | 'strip'; className?: string }) {
  const crawl = useCrawlStatus(60_000);
  const items = crawl?.stats ? Number(crawl.stats.total_menu_items) : null;

  return (
    <span className={`text-[#8A8E8C] ${className}`}>
      index{' '}
      <span className="text-[#9DFFB5]">{items === null ? '—' : items.toLocaleString()}</span>{' '}
      items
      <span className="text-[#4F5354] mx-2">·</span>
      crawled {crawledAgo(crawl?.stats?.last_crawl)}
    </span>
  );
}

export function MeterStrip() {
  const analytics = useAnalytics(5000);

  const settledAllTime = (analytics?.by_endpoint ?? []).reduce(
    (s, e) => s + (PRICE_USDC[e.endpoint] ?? 0.02) * Number(e.cnt),
    0,
  );
  const total = analytics?.total_requests ?? null;
  const reqs24h = analytics?.reqs_24h ?? 0;

  return (
    <div className="border-t border-[#22262A] pt-3 text-[13px] font-mono text-[#8A8E8C]">
      meter
      <span className="text-[#4F5354] mx-2">·</span>
      {total === null ? '—' : total.toLocaleString()} paid queries all-time
      <span className="text-[#4F5354] mx-2">·</span>
      <span className="text-[#9DFFB5]">${settledAllTime.toFixed(2)}</span> settled in usdc
      <span className="text-[#4F5354] mx-2">·</span>
      $0.02 per call
      <span className="text-[#4F5354] mx-2">·</span>
      no key, no subscription
      {reqs24h >= 25 && (
        <>
          <span className="text-[#4F5354] mx-2">·</span>
          <span className="text-[#9DFFB5]">{reqs24h.toLocaleString()} in the last 24h</span>
        </>
      )}
    </div>
  );
}
