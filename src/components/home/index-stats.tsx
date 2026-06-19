// Server component: the index inventory — the numbers that are big and real
// regardless of traffic. Rendered into initial HTML for crawlers/agents.

import type { IndexSnapshot } from '@/lib/index-snapshot';
import { CrawlFreshness } from './crawl-freshness';

function StatCard({
  value,
  label,
  accent,
}: {
  value: number | null;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="border border-[#22262A] bg-[#111315] rounded px-3.5 py-3">
      <div
        className="font-mono font-medium tabular-nums leading-none text-[28px] lg:text-[32px]"
        style={{ color: accent ? '#FFB976' : '#F1F1EE', letterSpacing: -0.5 }}
      >
        {value === null ? '—' : value.toLocaleString()}
      </div>
      <div className="text-[11px] text-[#8A8E8C] mt-1.5">{label}</div>
    </div>
  );
}

export function IndexStats({ snapshot }: { snapshot: IndexSnapshot | null }) {
  const enabledMetros = snapshot?.metros.filter((m) => m.enabled).length ?? null;
  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">
        INDEX · re-crawled every 6h
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard value={snapshot?.totalMenuItems ?? null} label="menu items indexed" />
        <StatCard value={snapshot?.totalDispensaries ?? null} label="dispensaries tracked" />
        <StatCard value={snapshot?.totalPriceChanges ?? null} label="price changes logged" accent />
        <StatCard value={enabledMetros} label="metros live" />
      </div>
      <div className="mt-2.5">
        <CrawlFreshness lastCrawl={snapshot?.lastCrawl ?? null} />
      </div>
    </div>
  );
}
