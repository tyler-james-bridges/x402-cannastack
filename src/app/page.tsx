// src/app/page.tsx
// Server component shell; the live pieces are client components below.
// Index stats are fetched server-side (revalidated every 5 min) so crawlers
// and agents that don't run JS still see real figures — including the
// schema.org Dataset block.

import { HeroPrompt } from '@/components/home/hero-prompt';
import { LiveMeter, MeterStrip } from '@/components/home/live-meter';
import { EventStream } from '@/components/home/event-stream';
import { UsMap } from '@/components/home/us-map';
import { IndexStats } from '@/components/home/index-stats';
import { RateCard } from '@/components/home/rate-card';
import { CurlSnippet } from '@/components/home/curl-snippet';
import { ConnectWallet } from '@/components/connect-wallet';
import { fetchIndexSnapshot } from '@/lib/index-snapshot';

export const revalidate = 300;

const BASE = 'https://cannastack.0x402.sh';

export default async function Home() {
  const snapshot = await fetchIndexSnapshot();

  const datasetJsonLd = snapshot
    ? {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'cannastack — US dispensary menus, prices, and deals',
        description:
          'Agent-native cannabis data: dispensary menus, prices, deals, and strain availability across US metros, re-crawled every 6 hours. Queryable per-call via x402 micropayments.',
        url: BASE,
        size: `${snapshot.totalMenuItems.toLocaleString()} menu items across ${snapshot.totalDispensaries.toLocaleString()} dispensaries`,
        dateModified: snapshot.lastCrawl ?? undefined,
        spatialCoverage: snapshot.metros.filter((m) => m.enabled).map((m) => m.name),
        distribution: ['strain-finder', 'price-compare', 'deal-scout', 'price-history'].map(
          (name) => ({
            '@type': 'DataDownload',
            contentUrl: `${BASE}/api/${name}`,
            encodingFormat: 'application/json',
          }),
        ),
        offers: { '@type': 'Offer', price: 0.02, priceCurrency: 'USDC' },
      }
    : null;

  return (
    <main className="min-h-screen bg-[#0B0C0D] text-[#F1F1EE] font-sans overflow-x-clip">
      {datasetJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetJsonLd) }}
        />
      )}

      {/* Top status strip */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[#22262A] text-xs font-mono">
        <span className="flex items-center gap-2 font-bold tracking-wide">
          <span className="w-2.5 h-2.5 bg-[#9DFFB5] rounded-sm shadow-[0_0_12px_#9DFFB5]" />
          CANNASTACK
        </span>
        <span className="text-[#4F5354] hidden sm:inline">/</span>
        <span className="text-[#8A8E8C] hidden sm:inline">agent-native cannabis data · x402</span>
        <LiveMeter className="ml-auto hidden md:inline" />
        <span className="text-[#4F5354] hidden md:inline">│</span>
        <a href="/docs" className="hidden md:inline hover:text-[#9DFFB5]">docs</a>
        <a href="https://github.com/tyler-james-bridges/x402-cannastack" className="hidden md:inline hover:text-[#9DFFB5]">github</a>
        <span className="text-[#4F5354] hidden md:inline">│</span>
        <ConnectWallet className="ml-auto md:ml-0" />
      </div>

      {/* HERO — prompt + live response */}
      <section className="px-6 lg:px-9 py-10 border-b border-[#22262A]">
        <HeroPrompt />
      </section>

      {/* THE INDEX — inventory + coverage + ledger, economics demoted to a strip */}
      <section className="px-6 lg:px-9 py-7 border-b border-[#22262A]">
        <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-7">
          <div className="flex flex-col gap-4 min-w-0">
            <IndexStats snapshot={snapshot} />
            <div className="flex-1 min-h-[170px] sm:min-h-[220px] relative border border-[#22262A] rounded-md overflow-hidden bg-[#111315]">
              <UsMap />
            </div>
          </div>
          <EventStream />
        </div>
        <div className="mt-6">
          <MeterStrip />
        </div>
      </section>

      {/* BOTTOM — rate card + curl */}
      <section className="px-6 lg:px-9 py-6 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-7">
        <RateCard />
        <CurlSnippet />
      </section>

      <footer className="px-6 lg:px-9 py-6 border-t border-[#22262A] text-xs font-mono text-[#4F5354] flex flex-wrap gap-4">
        <span>cannastack · public cannabis data, priced like an API call</span>
        <span className="ml-auto">
          <a href="/status" className="hover:text-[#9DFFB5]">status</a> ·{' '}
          <a href="/docs" className="hover:text-[#9DFFB5]">docs</a>
        </span>
      </footer>
    </main>
  );
}
