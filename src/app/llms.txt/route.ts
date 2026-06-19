import { ENDPOINTS } from '@/lib/endpoints';

const BASE = 'https://cannastack.0x402.sh';

export const dynamic = 'force-static';

export async function GET() {
  const lines: string[] = [];
  lines.push('# cannastack');
  lines.push('');
  lines.push(
    '> Agent-native cannabis data. Dispensary menus, prices, deals, and strain availability across the US, priced like an API call via x402. $0.02 per request, settled in USDC. No keys, no contracts.',
  );
  lines.push('');
  lines.push('## How to use');
  lines.push('');
  lines.push(
    '- Every paid endpoint is a single `POST` with JSON body. An unpaid request returns HTTP 402 with payment requirements in the `payment-required` header.',
  );
  lines.push(
    '- Pay per request via x402 micropayments on Base (eip155:8453), settled in USDC. Route the call through an x402-capable client (x402 fetch shim, AgentCash, or any wallet that speaks x402). The same URL serves both 402 and 200.',
  );
  lines.push('- US locations only. Provide a city name, "City, ST", or street address.');
  lines.push('- Geocoding and the underlying menu data come from Weedmaps; live-fallback kicks in when a metro is not yet in the database.');
  lines.push('');
  lines.push('## Workflows (next_actions)');
  lines.push('');
  lines.push(
    'Every paid response includes a `next_actions` array: ready-to-send follow-up calls with the endpoint `url`, a complete JSON `body`, and the `price_usdc`. To chain a workflow, POST the `body` as-is to the `url`, paying the same way — no parameter guessing. Examples of chains:',
  );
  lines.push('');
  lines.push('- deal-scout -> price-compare (are these deals actually cheap?) -> strain-finder (where else carries the best item?)');
  lines.push('- strain-finder -> price-history (is it trending down? wait or buy) -> deal-scout (any active deals first?)');
  lines.push('- Empty results return a `widen-radius` action retrying the same search at 50 miles.');
  lines.push('');
  lines.push(
    'Dispensary results include a `url` field — the shop page where a human can order. Surface it as the final call-to-action.',
  );
  lines.push('');
  lines.push('## Endpoints');
  lines.push('');
  for (const ep of ENDPOINTS) {
    lines.push(`### ${ep.name}  (${ep.method} ${BASE}${ep.path})`);
    lines.push('');
    lines.push(`Price: $${ep.price_usdc.toFixed(2)} USDC. ${ep.summary}`);
    lines.push('');
    lines.push('Parameters:');
    for (const p of ep.params) {
      lines.push(
        `- \`${p.name}\` (${p.type}, ${p.required ? 'required' : 'optional'}): ${p.description}`,
      );
    }
    lines.push('');
    lines.push('Example request:');
    lines.push('```json');
    lines.push(JSON.stringify(ep.example_request, null, 2));
    lines.push('```');
    lines.push('');
  }
  lines.push('## Discovery');
  lines.push('');
  lines.push(`- OpenAPI: ${BASE}/openapi.json`);
  lines.push(`- x402 manifest: ${BASE}/.well-known/x402.json`);
  lines.push(`- HTML docs: ${BASE}/docs`);
  lines.push(`- Status: ${BASE}/status (and JSON at ${BASE}/api/analytics)`);
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
