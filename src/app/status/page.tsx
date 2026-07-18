import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';
import { ENDPOINTS } from '@/lib/endpoints';

export const metadata = {
  title: 'Status',
  description: 'Cannastack processor catalog and data boundary status.',
};

const statusItems = [
  {
    label: 'Menu processors',
    value: `${ENDPOINTS.length} published`,
    detail: 'Readiness is evaluated on each request',
  },
  {
    label: 'External menu access',
    value: 'Disabled',
    detail: 'No crawling, retrieval, or external menu fetches',
  },
  {
    label: 'Application storage',
    value: 'Disabled',
    detail: 'Request processing is transient',
  },
  {
    label: 'Legacy retrieval',
    value: '410 Gone',
    detail: 'No payment challenge is issued',
  },
];

export default function StatusPage() {
  return (
    <PageShell
      eyebrow="Status / published boundary"
      title={
        <>
          The contract is published.
          <br />
          <span className="text-[#9DFFB5]">Retrieval stays disabled.</span>
        </>
      }
      subtitle="Cannastack publishes three paid processors for caller-supplied snapshots. Availability and payment readiness are evaluated on each request."
    >
      <section aria-labelledby="boundary-status">
        <div className="flex flex-wrap items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-sm border border-[#9DFFB5]" />
          <h2 id="boundary-status" className="font-mono text-xs uppercase tracking-[0.16em]">
            Published service configuration
          </h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#919793]">
          This reports the product boundary and published catalog. It is not a claim about external
          network uptime or third-party data freshness.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {statusItems.map((item) => (
            <article key={item.label} className="rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-6">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#919793]">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-[#F1F1EE]">{item.value}</p>
              <p className="mt-2 text-sm leading-6 text-[#A2A6A4]">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="overflow-hidden rounded-lg border border-[#314036] bg-[#101512]">
          <div className="border-b border-[#314036] px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold">Published processor catalog</h2>
          </div>
          <div className="divide-y divide-[#22262A]">
            {ENDPOINTS.map((endpoint) => (
              <div key={endpoint.name} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium">{endpoint.name}</p>
                  <p className="mt-1 break-all font-mono text-[11px] text-[#919793]">
                    {endpoint.method} {endpoint.path}
                  </p>
                </div>
                <div className="flex items-center gap-3 sm:justify-end">
                  <span className="h-2 w-2 rounded-sm border border-[#9DFFB5]" />
                  <span className="font-mono text-xs text-[#D7DAD7]">Published / {endpoint.price}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Trust boundary</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-[#A2A6A4]">
            <li>Input is supplied by the caller.</li>
            <li>Rights are caller-attested and unverified.</li>
            <li>Inventory verification is not performed.</li>
            <li>Payment verification uses an external facilitator, and settlement is public on Base.</li>
            <li>No orderability, live availability, medical, or quality claim is made.</li>
          </ul>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-3 border-t border-[#22262A] pt-5 text-sm">
            <Link href="/docs" className="text-[#9DFFB5] hover:underline">API docs</Link>
            <Link href="/openapi.json" className="text-[#9DFFB5] hover:underline">OpenAPI</Link>
          </div>
        </aside>
      </section>
    </PageShell>
  );
}
