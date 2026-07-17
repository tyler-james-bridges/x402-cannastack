import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';

export const metadata = {
  title: 'Service notice',
  description: 'Cannastack data endpoints are retired pending an authorized provider.',
};

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="Documentation / inactive"
      title={<>The data API documentation has been withdrawn.</>}
      subtitle="There are no request contracts, examples, prices, or paid resources to publish while the service is retired."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Current contract</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#A2A6A4]">
            <li>Active paid data endpoints: <strong className="font-medium text-[#F1F1EE]">0</strong></li>
            <li>Legacy data requests return <code className="text-[#F1F1EE]">410 Gone</code>.</li>
            <li>Retired routes do not issue an x402 payment challenge.</li>
            <li>No third-party data is available for retrieval.</li>
          </ul>
        </section>

        <section className="rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-7">
          <h2 className="text-xl font-semibold">Machine-readable status</h2>
          <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">Each discovery surface reports the same retired state and an empty endpoint catalog.</p>
          <div className="mt-5 flex flex-col items-start gap-3 font-mono text-xs">
            <Link href="/openapi.json" className="text-[#9DFFB5] hover:underline">/openapi.json</Link>
            <Link href="/llms.txt" className="text-[#9DFFB5] hover:underline">/llms.txt</Link>
            <Link href="/.well-known/x402.json" className="text-[#9DFFB5] hover:underline">/.well-known/x402.json</Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
