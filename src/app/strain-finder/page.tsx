import Link from 'next/link';
import { StrainFinderSearch } from '@/components/strain-finder-search';

export const metadata = {
  title: 'Strain Finder - x402-cannastack',
  description:
    'Find which dispensaries near you carry a specific strain. Cross-dispensary search sorted by price.',
};

export default function StrainFinderPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="mb-8">
          <Link
            href="/"
            className="text-xs font-mono text-white/30 hover:text-white/60 transition-colors"
          >
            &larr; x402-cannastack
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold font-mono mt-4">Strain Finder</h1>
          <p className="text-sm text-white/50 font-mono mt-2 max-w-xl leading-relaxed">
            Search for a specific strain across nearby dispensary menus. Results sorted by cheapest
            match. US locations only.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <StrainFinderSearch />
        </div>

        <div className="mt-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-4">
            How it works
          </h2>
          <div className="space-y-3 text-sm font-mono text-white/40">
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">1.</span>
              <span>Enter a strain name and your location</span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">2.</span>
              <span>
                We search menus at nearby dispensaries for matching products
              </span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">3.</span>
              <span>Results show which dispensaries carry it, sorted by cheapest price first</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-4">
            x402 API
          </h2>
          <p className="text-sm text-white/40 font-mono mb-3">
            Available as a paid x402 endpoint for agents and apps. $0.02 USDC per request, no API
            keys.
          </p>
          <div className="rounded-lg border border-white/5 bg-black p-3">
            <code className="text-[11px] text-white/50 font-mono break-all">
              bankr x402 call .../strain-finder -d
              {' \'{"strain":"Blue Dream","location":"Phoenix, AZ"}\''}
            </code>
          </div>
        </div>
      </div>
    </main>
  );
}
