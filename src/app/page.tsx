// src/app/page.tsx
// Drop-in replacement for the homepage. Server component shell; the live
// pieces are client components below.

import { HeroPrompt } from '@/components/home/hero-prompt';
import { LiveMeter } from '@/components/home/live-meter';
import { EventStream } from '@/components/home/event-stream';
import { UsMap } from '@/components/home/us-map';
import { RateCard } from '@/components/home/rate-card';
import { CurlSnippet } from '@/components/home/curl-snippet';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0B0C0D] text-[#F1F1EE] font-sans">
      {/* Top status strip */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[#22262A] text-xs font-mono">
        <span className="flex items-center gap-2 font-bold tracking-wide">
          <span className="w-2.5 h-2.5 bg-[#9DFFB5] rounded-sm shadow-[0_0_12px_#9DFFB5]" />
          CANNASTACK
        </span>
        <span className="text-[#4F5354]">/</span>
        <span className="text-[#8A8E8C]">agent-native cannabis data · x402</span>
        <LiveMeter variant="strip" className="ml-auto" />
        <span className="text-[#4F5354] hidden md:inline">│</span>
        <a href="/docs" className="hidden md:inline hover:text-[#9DFFB5]">docs</a>
        <a href="https://github.com/tyler-james-bridges/x402-cannastack" className="hidden md:inline hover:text-[#9DFFB5]">github</a>
      </div>

      {/* HERO — prompt + live response */}
      <section className="px-6 lg:px-9 py-10 border-b border-[#22262A]">
        <HeroPrompt />
      </section>

      {/* MIDDLE — meter + map + event stream */}
      <section className="px-6 lg:px-9 py-7 border-b border-[#22262A] grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-7">
        <div className="flex flex-col gap-4 min-w-0">
          <LiveMeter variant="hero" />
          <div className="flex-1 min-h-[220px] relative border border-[#22262A] rounded-md overflow-hidden bg-[#111315]">
            <UsMap />
            <div className="absolute top-2.5 left-3 text-[10px] font-mono text-[#4F5354] tracking-[1.4px]">
              LIVE QUERIES
            </div>
          </div>
        </div>
        <EventStream />
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
