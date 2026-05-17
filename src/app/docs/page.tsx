import { PageShell } from '@/components/home/page-shell';
import { ENDPOINTS, type EndpointSpec } from '@/lib/endpoints';

export const metadata = {
  title: 'Docs',
  description:
    'API documentation for cannastack. Cannabis menus, prices, deals, and strain availability. $0.02 per call via x402.',
};

const BASE = 'https://cannastack.0x402.sh';

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-[#111315] border border-[#22262A] rounded p-3.5 font-mono text-[11px] leading-[1.7] overflow-x-auto text-[#F1F1EE]">
      {children}
    </pre>
  );
}

function EndpointCard({ ep }: { ep: EndpointSpec }) {
  const curl = `curl -X POST ${BASE}${ep.path} \\
  -H 'Content-Type: application/json' \\
  -d '${JSON.stringify(ep.example_request)}'`;

  return (
    <section id={ep.name} className="border-t border-[#22262A] py-7">
      <div className="flex items-baseline gap-3 flex-wrap">
        <h2 className="text-2xl font-semibold tracking-tight">{ep.name}</h2>
        <span className="font-mono text-[11px] text-[#9DFFB5] tracking-[1.4px]">
          ${ep.price_usdc.toFixed(2)} per call
        </span>
        <span className="ml-auto font-mono text-[11px] text-[#4F5354]">
          {ep.method} {ep.path}
        </span>
      </div>
      <p className="text-sm text-[#8A8E8C] mt-2 max-w-[640px]">{ep.summary}</p>

      <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">PARAMETERS</div>
          <div className="border border-[#22262A] rounded overflow-hidden">
            {ep.params.map((p, i) => (
              <div
                key={p.name}
                className={`px-3.5 py-2.5 ${i > 0 ? 'border-t border-[#22262A]' : ''} bg-[#111315]`}
              >
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-sm font-semibold">{p.name}</span>
                  <span className="font-mono text-[10px] text-[#7AB8FF]">{p.type}</span>
                  <span className="font-mono text-[10px] text-[#FFB976]">
                    {p.required ? 'required' : 'optional'}
                  </span>
                </div>
                <div className="text-[12px] text-[#8A8E8C] mt-1">{p.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">REQUEST</div>
            <CodeBlock>{JSON.stringify(ep.example_request, null, 2)}</CodeBlock>
          </div>
          <div>
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">CURL</div>
            <CodeBlock>{curl}</CodeBlock>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">RESPONSE (truncated)</div>
        <CodeBlock>{JSON.stringify(ep.example_response, null, 2)}</CodeBlock>
      </div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <PageShell
      eyebrow="docs · API reference"
      title={
        <>
          API reference,<br />
          <span className="text-[#9DFFB5]">no keys, no contracts.</span>
        </>
      }
      subtitle="Every endpoint is a single POST. Pay per request in USDC via x402. Same JSON for humans, agents, and on-chain wallets."
    >
      <section className="pb-6 max-w-[900px]">
        <h2 className="text-xl font-semibold tracking-tight">Quick start</h2>
        <p className="text-sm text-[#8A8E8C] mt-2 leading-relaxed">
          Open access: every endpoint accepts plain JSON POST with no auth. For metered access via the
          x402 micropayment protocol, route the call through a wallet-capable client (Bankr, AgentCash,
          the x402 fetch shim). The exact same endpoint serves both — the gateway settles USDC before
          forwarding the request.
        </p>
        <div className="mt-4">
          <CodeBlock>{`# Free preview from any terminal
curl -X POST ${BASE}/api/strain-finder \\
  -H 'Content-Type: application/json' \\
  -d '{"strain":"Blue Dream","location":"Denver, CO"}'`}</CodeBlock>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="border border-[#22262A] rounded p-3.5 bg-[#111315]">
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px]">PRICING</div>
            <div className="text-sm mt-1">$0.02 per request, settled in USDC. No subscriptions.</div>
          </div>
          <div className="border border-[#22262A] rounded p-3.5 bg-[#111315]">
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px]">COVERAGE</div>
            <div className="text-sm mt-1">13 US metros crawled. Live Weedmaps fallback elsewhere.</div>
          </div>
          <div className="border border-[#22262A] rounded p-3.5 bg-[#111315]">
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px]">LATENCY</div>
            <div className="text-sm mt-1">DB-backed responses typically under 600ms. Live fallback under 2s.</div>
          </div>
          <div className="border border-[#22262A] rounded p-3.5 bg-[#111315]">
            <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px]">DISCOVERY</div>
            <div className="text-sm mt-1">
              <a href="/openapi.json" className="hover:text-[#9DFFB5]">openapi.json</a>
              <span className="text-[#4F5354] mx-1.5">·</span>
              <a href="/llms.txt" className="hover:text-[#9DFFB5]">llms.txt</a>
              <span className="text-[#4F5354] mx-1.5">·</span>
              <a href="/.well-known/x402.json" className="hover:text-[#9DFFB5]">x402.json</a>
            </div>
          </div>
        </div>

        <div className="mt-7">
          <h2 className="text-xl font-semibold tracking-tight">Endpoints</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {ENDPOINTS.map((e) => (
              <a
                key={e.name}
                href={`#${e.name}`}
                className="px-3 py-1.5 border border-[#22262A] rounded-full text-xs font-mono text-[#8A8E8C] bg-[#111315] hover:text-[#F1F1EE] hover:border-[#4F5354]"
              >
                {e.name} · ${e.price_usdc.toFixed(2)}
              </a>
            ))}
          </div>
        </div>
      </section>

      {ENDPOINTS.map((ep) => (
        <EndpointCard key={ep.name} ep={ep} />
      ))}

      <section className="border-t border-[#22262A] py-7 max-w-[900px]">
        <h2 className="text-xl font-semibold tracking-tight">Errors</h2>
        <p className="text-sm text-[#8A8E8C] mt-2 leading-relaxed">
          Every error responds with HTTP 4xx/5xx and a JSON body of the shape{' '}
          <code className="font-mono text-[12px] text-[#FF7361]">{`{"ok":false,"error":"…"}`}</code>.
          The most common cases: <code className="font-mono text-[12px]">Missing &apos;strain&apos;</code> /{' '}
          <code className="font-mono text-[12px]">Missing &apos;location&apos;</code> /{' '}
          <code className="font-mono text-[12px]">Could not geocode</code> (US locations only) /{' '}
          <code className="font-mono text-[12px]">Unknown category</code>.
        </p>
      </section>
    </PageShell>
  );
}
