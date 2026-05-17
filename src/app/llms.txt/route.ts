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
    '- Every endpoint is a single `POST` with JSON body. No auth header required for previewing.',
  );
  lines.push(
    '- For metered access via x402 micropayments, route the request through an x402-capable client (Bankr, AgentCash, x402 fetch shim). The same URL serves both.',
  );
  lines.push('- US locations only. Provide a city name, "City, ST", or street address.');
  lines.push('- Geocoding and the underlying menu data come from Weedmaps; live-fallback kicks in when a metro is not yet in the database.');
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
