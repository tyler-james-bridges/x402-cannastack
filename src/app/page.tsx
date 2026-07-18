import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';
import { ENDPOINTS } from '@/lib/endpoints';

export default function Home() {
  return (
    <PageShell
      eyebrow="Source-neutral menu processing / x402"
      title={
        <>
          Bring your own menu.
          <br />
          <span className="text-[#9DFFB5]">Keep control of the source.</span>
        </>
      }
      subtitle="Cannastack normalizes, compares, and ranks menu snapshots supplied in your request. It does not retrieve or publish third-party inventory."
    >
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#51705A] bg-[#152019] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#9DFFB5]">
              Contract published
            </span>
            <span className="font-mono text-xs text-[#919793]">
              {ENDPOINTS.length} processors / {ENDPOINTS[0]?.price} each
            </span>
          </div>
          <h2 className="mt-7 max-w-2xl text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Your JSON in. Deterministic processing out.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-[#A2A6A4] sm:text-base sm:leading-7">
            Attest that you have rights to the snapshot, choose an operation, and submit it as
            JSON. Valid requests use x402 payment. Invalid requests are rejected before payment.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-sm">
            <Link
              href="/docs"
              className="rounded border border-[#9DFFB5] bg-[#9DFFB5] px-4 py-2.5 font-medium text-[#0B0C0D] transition-colors hover:bg-[#C4FFD1]"
            >
              Read the API docs
            </Link>
            <Link
              href="/.well-known/x402.json"
              className="rounded border border-[#3B423E] px-4 py-2.5 text-[#D3D6D3] transition-colors hover:border-[#667069] hover:text-white"
            >
              Inspect service catalog
            </Link>
          </div>
        </section>

        <aside className="rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-7">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#919793]">
            Processing boundary
          </h2>
          <dl className="mt-5 divide-y divide-[#22262A] text-sm">
            <div className="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt className="text-[#A2A6A4]">Input source</dt>
              <dd className="text-right text-[#F1F1EE]">Caller supplied</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt className="text-[#A2A6A4]">External menu access</dt>
              <dd className="text-right text-[#F1F1EE]">Disabled</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt className="text-[#A2A6A4]">Application storage</dt>
              <dd className="text-right text-[#F1F1EE]">Disabled</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-3">
              <dt className="text-[#A2A6A4]">Rights verification</dt>
              <dd className="text-right text-[#F1F1EE]">Not performed</dd>
            </div>
          </dl>
          <p className="mt-5 border-l border-[#51705A] pl-4 text-xs leading-5 text-[#919793]">
            Rights are caller-attested and unverified. Results do not claim inventory,
            orderability, live availability, medical value, or quality.
          </p>
        </aside>
      </div>

      <section className="mt-10" aria-labelledby="processors-heading">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#919793]">
              Published catalog
            </p>
            <h2 id="processors-heading" className="mt-2 text-2xl font-semibold tracking-tight">
              {ENDPOINTS.length} ways to process your snapshot
            </h2>
          </div>
          <Link href="/docs" className="sm:ml-auto text-sm text-[#9DFFB5] hover:underline">
            Request contracts
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {ENDPOINTS.map((endpoint, index) => (
            <Link
              key={endpoint.name}
              href={`/docs#${endpoint.name}`}
              className="group min-w-0 rounded-lg border border-[#22262A] bg-[#111315] p-5 transition-colors hover:border-[#51705A] hover:bg-[#131814]"
            >
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.15em] text-[#919793]">
                <span className="text-[#9DFFB5]">0{index + 1}</span>
                <span>{endpoint.operation}</span>
                <span className="ml-auto">{endpoint.price}</span>
              </div>
              <h3 className="mt-5 text-lg font-semibold">{endpoint.name}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-[#A2A6A4]">
                {endpoint.summary}
              </p>
              <p className="mt-5 break-all font-mono text-[11px] text-[#919793] group-hover:text-[#9DFFB5]">
                {endpoint.method} {endpoint.path}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-lg border border-[#22262A] bg-[#0E1011] p-5 sm:flex sm:items-center sm:gap-6 sm:p-6">
        <div>
          <h2 className="text-lg font-semibold">Machine-readable from the first request</h2>
          <p className="mt-1 text-sm leading-6 text-[#A2A6A4]">
            Full schemas, payment metadata, service boundaries, and legacy route behavior are
            published without sample inventory.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 font-mono text-xs sm:ml-auto sm:mt-0 sm:justify-end">
          <Link href="/openapi.json" className="text-[#9DFFB5] hover:underline">OpenAPI</Link>
          <Link href="/llms.txt" className="text-[#9DFFB5] hover:underline">llms.txt</Link>
          <Link href="/status" className="text-[#9DFFB5] hover:underline">Status</Link>
        </div>
      </section>
    </PageShell>
  );
}
