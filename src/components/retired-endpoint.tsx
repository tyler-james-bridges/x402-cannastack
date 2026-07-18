import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';

export function RetiredEndpointPage() {
  return (
    <PageShell
      eyebrow="Legacy route / retired"
      title={<>This legacy retrieval endpoint is retired.</>}
      subtitle="Cannastack no longer retrieves third-party inventory here. Its published processors only accept menu snapshots supplied by callers who attest they have rights."
    >
      <section className="max-w-2xl rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
        <p className="text-sm leading-6 text-[#A2A6A4]">
          Machine requests to the corresponding legacy API route receive HTTP 410 Gone without an
          x402 payment challenge. Bring your own authorized snapshot to the published normalize,
          compare, or recommend processors instead.
        </p>
        <div className="mt-5 flex flex-wrap gap-4 text-sm">
          <Link href="/docs" className="text-[#9DFFB5] hover:underline">Bring-your-own-menu docs</Link>
          <Link href="/status" className="text-[#A2A6A4] hover:text-[#F1F1EE]">Status</Link>
        </div>
      </section>
    </PageShell>
  );
}
