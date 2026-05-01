import Link from 'next/link';

const endpoints = [
  {
    name: 'weedmaps-recs',
    price: '$0.03',
    description: 'Dispensary finder + product recommendations near any US location',
  },
  {
    name: 'night-out',
    price: '$0.05',
    description: 'Multi-source local planner: dispensaries + bars + restaurants + breweries',
  },
  {
    name: 'strain-finder',
    price: '$0.02',
    description: 'Cross-dispensary strain search sorted by price',
    href: '/strain-finder',
  },
  {
    name: 'price-compare',
    price: '$0.02',
    description: 'Category price comparison across nearby dispensaries',
    href: '/price-compare',
  },
  {
    name: 'deal-scout',
    price: '$0.02',
    description: 'Find dispensaries with active deals near you',
    href: '/deal-scout',
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl md:text-5xl font-bold font-mono">x402-cannastack</h1>
        <p className="mt-4 text-lg text-white/50 font-mono max-w-xl leading-relaxed">
          Agent-native cannabis data. Dispensary menus, prices, deals, and strain availability.
          Pay per request via x402. No API keys. No contracts.
        </p>

        <div className="mt-12">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-6">
            Live endpoints
          </h2>
          <div className="space-y-3">
            {endpoints.map((ep) => (
              <div
                key={ep.name}
                className="rounded-xl border border-white/10 bg-white/[0.02] p-5 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {'href' in ep && ep.href ? (
                      <Link href={ep.href} className="text-base font-mono font-bold text-white hover:text-white/80 transition-colors">
                        {ep.name}
                      </Link>
                    ) : (
                      <p className="text-base font-mono font-bold text-white">{ep.name}</p>
                    )}
                    <p className="text-sm text-white/40 font-mono mt-1">{ep.description}</p>
                  </div>
                  <span className="text-sm font-mono text-green-400 shrink-0">{ep.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-4">
            How it works
          </h2>
          <div className="space-y-3 text-sm font-mono text-white/40">
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">1.</span>
              <span>Pick an endpoint. Send a POST with your query.</span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">2.</span>
              <span>Pay with USDC via x402 (automatic, no wallet setup for agents).</span>
            </div>
            <div className="flex gap-3">
              <span className="text-white/20 shrink-0">3.</span>
              <span>Get structured cannabis data. Use it however you want.</span>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="text-sm font-mono uppercase tracking-wider text-white/40 mb-4">
            Quick start
          </h2>
          <div className="rounded-lg border border-white/5 bg-black p-4 overflow-x-auto">
            <pre className="text-[12px] text-white/50 font-mono whitespace-pre">
{`bankr x402 call \\
  https://x402.bankr.bot/.../strain-finder \\
  -d '{"strain":"Blue Dream","location":"Phoenix, AZ"}'`}
            </pre>
          </div>
        </div>

        <div className="mt-16 text-center">
          <p className="text-[11px] text-white/20 font-mono">
            Built on x402. Powered by public data.
          </p>
        </div>
      </div>
    </main>
  );
}
