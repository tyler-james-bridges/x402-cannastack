import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';

export default function Home() {
  return (
    <PageShell
      eyebrow="Service notice / retired"
      title={<>The data service is retired.</>}
      subtitle="Cannastack is not serving cannabis menu, listing, or price data while it waits for an authorized provider. No paid data products are active."
    >
      <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#526358] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8C0BB]">
              Retired
            </span>
            <span className="font-mono text-xs text-[#686D6A]">Public data API</span>
          </div>
          <p className="mt-6 max-w-xl text-xl leading-8 text-[#E3E5E2]">
            Previously published data is unavailable through the public surface. Legacy data routes return HTTP 410 Gone and do not request payment.
          </p>
        </section>

        <aside className="rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-7">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#686D6A]">Current state</h2>
          <dl className="mt-5 divide-y divide-[#22262A] text-sm">
            <div className="flex gap-4 py-3"><dt className="text-[#A2A6A4]">Paid endpoints</dt><dd className="ml-auto text-[#F1F1EE]">0 active</dd></div>
            <div className="flex gap-4 py-3"><dt className="text-[#A2A6A4]">Data access</dt><dd className="ml-auto text-[#F1F1EE]">Unavailable</dd></div>
            <div className="flex gap-4 py-3"><dt className="text-[#A2A6A4]">Payment requests</dt><dd className="ml-auto text-[#F1F1EE]">Disabled</dd></div>
          </dl>
          <div className="mt-6 flex flex-wrap gap-3 text-sm">
            <Link href="/docs" className="text-[#9DFFB5] hover:underline">Read the notice</Link>
            <Link href="/status" className="text-[#A2A6A4] hover:text-[#F1F1EE]">View status</Link>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
