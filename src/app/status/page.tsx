import { PageShell } from '@/components/home/page-shell';
import { headers } from 'next/headers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = {
  title: 'Status · cannastack',
  description: 'Live system status, crawler health, and request volume for cannastack.',
};

async function getBaseUrl() {
  const h = await headers();
  const host = h.get('host');
  const proto = host?.includes('localhost') ? 'http' : 'https';
  return `${proto}://${host}`;
}

type Analytics = {
  ok: boolean;
  total_requests?: number;
  reqs_24h?: number;
  usdc_24h?: number;
  by_endpoint?: { endpoint: string; cnt: string; avg_ms: string }[];
};

type CrawlStatus = {
  ok: boolean;
  metros?: { id: number; name: string; enabled: boolean }[];
  stats?: {
    total_dispensaries: string;
    total_menu_items: string;
    total_price_changes: string;
    last_crawl: string | null;
  };
  recentCrawls?: {
    metro_name: string;
    dispensaries_found: number;
    items_crawled: number;
    duration_ms: number;
    completed_at: string;
    errors: number;
  }[];
};

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

function Card({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="border border-[#22262A] rounded p-4 bg-[#111315]">
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px]">{label}</div>
      <div className="text-2xl font-semibold mt-1.5">{value}</div>
      {hint ? <div className="text-[11px] text-[#8A8E8C] mt-1 font-mono">{hint}</div> : null}
    </div>
  );
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

export default async function StatusPage() {
  const base = await getBaseUrl();
  const [a, c] = await Promise.all([
    safeFetch<Analytics>(`${base}/api/analytics`),
    safeFetch<CrawlStatus>(`${base}/api/crawl/status`),
  ]);

  const apiUp = !!a?.ok;
  const crawlerUp = !!c?.ok;

  return (
    <PageShell
      eyebrow="status · system health"
      title={
        <>
          System status,<br />
          <span className="text-[#9DFFB5]">live from production.</span>
        </>
      }
      subtitle="Public health check. API uptime, crawler activity, and data freshness — refreshed on every load."
    >
      <div className="max-w-[1100px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card
            label="API"
            value={
              <span className={apiUp ? 'text-[#9DFFB5]' : 'text-[#FF7361]'}>
                {apiUp ? 'operational' : 'degraded'}
              </span>
            }
            hint="POST /api/* endpoints"
          />
          <Card
            label="CRAWLER"
            value={
              <span className={crawlerUp ? 'text-[#9DFFB5]' : 'text-[#FF7361]'}>
                {crawlerUp ? 'operational' : 'degraded'}
              </span>
            }
            hint={`last crawl ${timeAgo(c?.stats?.last_crawl)}`}
          />
          <Card
            label="REQUESTS 24H"
            value={a?.reqs_24h?.toLocaleString() ?? '—'}
            hint={`${a?.total_requests?.toLocaleString() ?? '—'} all time`}
          />
          <Card
            label="USDC SETTLED 24H"
            value={<span className="text-[#9DFFB5]">${(a?.usdc_24h ?? 0).toFixed(2)}</span>}
            hint="at $0.02 / call"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Card
            label="DISPENSARIES"
            value={Number(c?.stats?.total_dispensaries ?? 0).toLocaleString()}
            hint={`${c?.metros?.length ?? 0} metros`}
          />
          <Card
            label="MENU ITEMS"
            value={Number(c?.stats?.total_menu_items ?? 0).toLocaleString()}
          />
          <Card
            label="PRICE CHANGES"
            value={Number(c?.stats?.total_price_changes ?? 0).toLocaleString()}
            hint="historical observations"
          />
        </div>

        <section className="mt-8">
          <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">
            ENDPOINT LATENCY (avg, lifetime)
          </div>
          <div className="border border-[#22262A] rounded overflow-hidden">
            {(a?.by_endpoint ?? []).map((row, i) => (
              <div
                key={row.endpoint}
                className={`flex items-center gap-3 px-3.5 py-2.5 bg-[#111315] ${
                  i > 0 ? 'border-t border-[#22262A]' : ''
                }`}
              >
                <span className="font-mono text-sm font-semibold">{row.endpoint}</span>
                <span className="ml-auto font-mono text-xs text-[#8A8E8C]">
                  {Number(row.cnt).toLocaleString()} calls
                </span>
                <span className="font-mono text-xs text-[#9DFFB5] w-16 text-right">
                  {row.avg_ms}ms
                </span>
              </div>
            ))}
            {!a?.by_endpoint?.length ? (
              <div className="px-3.5 py-2.5 bg-[#111315] text-xs font-mono text-[#4F5354]">
                no traffic recorded yet
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-8">
          <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">
            RECENT CRAWLS
          </div>
          <div className="border border-[#22262A] rounded overflow-hidden">
            {(c?.recentCrawls ?? []).slice(0, 10).map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3.5 py-2.5 bg-[#111315] ${
                  i > 0 ? 'border-t border-[#22262A]' : ''
                }`}
              >
                <span className="font-mono text-sm">{row.metro_name}</span>
                <span className="font-mono text-xs text-[#8A8E8C]">
                  {row.dispensaries_found} shops
                </span>
                <span className="font-mono text-xs text-[#8A8E8C]">{row.items_crawled} items</span>
                <span className="font-mono text-xs text-[#4F5354] w-20 text-right">
                  {timeAgo(row.completed_at)}
                </span>
              </div>
            ))}
            {!c?.recentCrawls?.length ? (
              <div className="px-3.5 py-2.5 bg-[#111315] text-xs font-mono text-[#4F5354]">
                no crawl history
              </div>
            ) : null}
          </div>
        </section>

        <p className="text-[11px] font-mono text-[#4F5354] mt-6">
          machine-readable status:{' '}
          <a href="/api/analytics" className="hover:text-[#9DFFB5]">/api/analytics</a>
          <span className="mx-2">·</span>
          <a href="/api/crawl/status" className="hover:text-[#9DFFB5]">/api/crawl/status</a>
        </p>
      </div>
    </PageShell>
  );
}
