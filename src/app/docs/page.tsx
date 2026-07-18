import Link from 'next/link';
import { PageShell } from '@/components/home/page-shell';
import { ENDPOINTS, type EndpointSpec } from '@/lib/endpoints';
import {
  DATA_RIGHTS_VERSION,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
} from '@/lib/menu-contract';

export const metadata = {
  title: 'API docs',
  description: 'Request contracts and x402 flow for Cannastack caller-supplied menu processors.',
};

const BASE = 'https://cannastack.0x402.sh';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="max-w-full overflow-x-auto rounded-md border border-[#22262A] bg-[#0B0C0D] p-4 font-mono text-[11px] leading-6 text-[#D7DAD7]">
      <code>{children}</code>
    </pre>
  );
}

function requiredFields(endpoint: EndpointSpec): string[] {
  const required = endpoint.request_schema.required;
  return Array.isArray(required)
    ? required.filter((field): field is string => typeof field === 'string')
    : [];
}

function EndpointCard({ endpoint }: { endpoint: EndpointSpec }) {
  const command = `curl --include --request ${endpoint.method} '${BASE}${endpoint.path}' \\
  --header 'content-type: application/json' \\
  --data-binary @authorized-menu-request.json`;

  return (
    <section
      id={endpoint.name}
      className="min-w-0 max-w-full scroll-mt-6 rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-6"
    >
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#9DFFB5]">
            {endpoint.method} / {endpoint.price} {endpoint.asset} / {endpoint.scheme} /{' '}
            {endpoint.network}
          </p>
          <h3 className="mt-2 text-xl font-semibold">{endpoint.name}</h3>
        </div>
        <code className="w-full break-all font-mono text-[11px] text-[#919793] sm:ml-auto sm:w-auto sm:max-w-[55%] sm:text-right">
          {endpoint.path}
        </code>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">{endpoint.summary}</p>

      <dl className="mt-5 grid gap-3 text-xs sm:grid-cols-2">
        <div className="rounded border border-[#22262A] bg-[#0E1011] p-3">
          <dt className="font-mono uppercase tracking-[0.12em] text-[#919793]">Required top level</dt>
          <dd className="mt-2 break-words leading-5 text-[#D7DAD7]">
            {requiredFields(endpoint).join(', ')}
          </dd>
        </div>
        <div className="rounded border border-[#22262A] bg-[#0E1011] p-3">
          <dt className="font-mono uppercase tracking-[0.12em] text-[#919793]">Execution</dt>
          <dd className="mt-2 leading-5 text-[#D7DAD7]">
            Transient, no external menu data, no application storage
          </dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#919793]">
          Caller-authorized input file
        </p>
        <CodeBlock>{command}</CodeBlock>
      </div>

      <div className="mt-4 font-mono text-[11px]">
        <Link
          href="/openapi.json"
          className="text-[#9DFFB5] hover:underline"
        >
          Request and response schemas in OpenAPI
        </Link>
      </div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="Documentation / published contract"
      title={
        <>
          Submit a snapshot.
          <br />
          <span className="text-[#9DFFB5]">Pay only after validation.</span>
        </>
      }
      subtitle={`All ${ENDPOINTS.length} processors accept caller-authorized JSON files, enforce the same rights boundary, and cost ${ENDPOINTS[0]?.price} per successfully paid request through x402.`}
    >
      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="min-w-0 rounded-lg border border-[#314036] bg-[#101512] p-5 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9DFFB5]">
            Request and payment flow
          </p>
          <ol className="mt-5 space-y-4 text-sm leading-6 text-[#C4C8C5]">
            <li className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="font-mono text-[#9DFFB5]">01</span>
              <span>Prepare an operation-specific JSON file that satisfies the published request schema.</span>
            </li>
            <li className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="font-mono text-[#9DFFB5]">02</span>
              <span>Submit it once. Invalid input returns an uncharged 4xx response before payment handling.</span>
            </li>
            <li className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="font-mono text-[#9DFFB5]">03</span>
              <span>A valid unpaid request returns HTTP 402 in both the PAYMENT-REQUIRED header and decoded JSON body.</span>
            </li>
            <li className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="font-mono text-[#9DFFB5]">04</span>
              <span>Authorize with an x402 v2 capable client and retry the same URL and file.</span>
            </li>
            <li className="grid grid-cols-[1.75rem_1fr] gap-2">
              <span className="font-mono text-[#9DFFB5]">05</span>
              <span>Success returns HTTP 200 with PAYMENT-RESPONSE. Payment verification uses an external facilitator, and settlement is public on Base.</span>
            </li>
          </ol>
        </div>

        <aside className="min-w-0 rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-7">
          <h2 className="text-lg font-semibold">Rights attestation</h2>
          <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">
            Every request must include <code className="text-[#D7DAD7]">data_authorization</code>.
            The submitter attests that they have rights, identifies the rights basis, and confirms
            the snapshot contains no personal data. Cannastack does not verify the attestation.
          </p>
          <p className="mt-3 text-sm leading-6 text-[#919793]">
            Outputs make no inventory, orderability, live availability, medical, or quality claims.
          </p>
          <dl className="mt-5 space-y-3 border-t border-[#22262A] pt-5 font-mono text-[11px]">
            <div className="flex flex-wrap gap-2"><dt className="text-[#919793]">request</dt><dd className="ml-auto break-all text-right text-[#D7DAD7]">{MENU_SCHEMA_VERSION}</dd></div>
            <div className="flex flex-wrap gap-2"><dt className="text-[#919793]">rights</dt><dd className="ml-auto break-all text-right text-[#D7DAD7]">{DATA_RIGHTS_VERSION}</dd></div>
            <div className="flex flex-wrap gap-2"><dt className="text-[#919793]">ruleset</dt><dd className="ml-auto break-all text-right text-[#D7DAD7]">{MENU_RULESET_VERSION}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="mt-10" aria-labelledby="endpoint-reference">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#919793]">
            Endpoint reference
          </p>
          <h2 id="endpoint-reference" className="mt-2 text-2xl font-semibold">
            Choose one processor
          </h2>
          <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">
            The file path below belongs to the caller. Its contents must match the full JSON Schema
            for that operation. Cannastack publishes no sample inventory.
          </p>
        </div>
        <div className="mt-5 grid gap-4">
          {ENDPOINTS.map((endpoint) => (
            <EndpointCard key={endpoint.name} endpoint={endpoint} />
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Uncharged validation responses</h2>
          <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">
            <code className="text-[#F1F1EE]">400</code> malformed body,{' '}
            <code className="text-[#F1F1EE]">403</code> invalid rights attestation,{' '}
            <code className="text-[#F1F1EE]">413</code> limit exceeded,{' '}
            <code className="text-[#F1F1EE]">415</code> unsupported content, and{' '}
            <code className="text-[#F1F1EE]">422</code> schema-invalid input.
          </p>
          <p className="mt-3 text-sm leading-6 text-[#919793]">
            Payment service and configuration failures return 502 or 503 without a processing result.
          </p>
          <p className="mt-3 border-l border-[#B89A5A] pl-3 text-sm leading-6 text-[#C8B98F]">
            If a 502 reports <code className="break-all">payment_settlement_indeterminate</code>, inspect PAYMENT-RESPONSE
            and the public onchain state. Do not submit a new payment authorization until the
            original is confirmed unsettled.
          </p>
        </div>
        <div className="min-w-0 rounded-lg border border-[#22262A] bg-[#111315] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Discovery and legacy behavior</h2>
          <p className="mt-3 text-sm leading-6 text-[#A2A6A4]">
            Legacy retrieval APIs return HTTP 410 without a payment challenge. Active schemas and
            payment metadata are available through each discovery surface. The x402.json document
            is a Cannastack service catalog, not an official protocol manifest.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 font-mono text-xs">
            <Link href="/openapi.json" className="text-[#9DFFB5] hover:underline">openapi.json</Link>
            <Link href="/.well-known/x402.json" className="text-[#9DFFB5] hover:underline">x402.json</Link>
            <Link href="/llms.txt" className="text-[#9DFFB5] hover:underline">llms.txt</Link>
            <Link href="/status" className="text-[#9DFFB5] hover:underline">status</Link>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
