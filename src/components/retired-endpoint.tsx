import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';

export function RetiredEndpointPage() {
  return (
    <PageShell
      eyebrow="Legacy route / retired"
      title={<>This data endpoint has been retired.</>}
      subtitle="No data or payment request is available here. Cannastack will not publish third-party menu, listing, or price data without an authorized provider."
    >
      <section className="max-w-2xl rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
        <p className="text-sm leading-6 text-[#A2A6A4]">
          Machine requests to the corresponding legacy API route receive HTTP 410 Gone without an x402 payment challenge.
        </p>
        <div className="mt-5 flex gap-4 text-sm">
          <Link href="/docs" className="text-[#9DFFB5] hover:underline">Service notice</Link>
          <Link href="/status" className="text-[#A2A6A4] hover:text-[#F1F1EE]">Status</Link>
        </div>
      </section>
    </PageShell>
  );
}
