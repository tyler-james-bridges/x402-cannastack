import { RETIREMENT_MESSAGE } from '@/lib/endpoints';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

export async function GET() {
  const text = `# Cannastack

> ${RETIREMENT_MESSAGE}

## Service status

- Active paid data endpoints: 0.
- Legacy data routes return HTTP 410 Gone without an x402 payment challenge.
- No third-party menu, listing, or price data is available.
- Data service reactivation requires an authorized provider.

## Discovery

- OpenAPI: ${BASE}/openapi.json
- x402 manifest: ${BASE}/.well-known/x402.json
- Human-readable notice: ${BASE}/docs
- Status: ${BASE}/status
`;

  return new Response(text, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
