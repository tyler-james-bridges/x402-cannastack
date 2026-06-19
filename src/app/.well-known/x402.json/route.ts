import { ENDPOINTS } from '@/lib/endpoints';
import {
  ACTIVE_CHAIN,
  ACTIVE_NETWORK,
  ACTIVE_FACILITATOR_URL,
  BASE_USDC,
  ABSTRACT_USDC,
} from '@/lib/x402';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

export async function GET() {
  const manifest = {
    name: 'cannastack',
    description:
      'Agent-native cannabis data. Dispensary menus, prices, deals, and strain availability priced per request via x402.',
    homepage: BASE,
    docs: `${BASE}/docs`,
    openapi: `${BASE}/openapi.json`,
    llms_txt: `${BASE}/llms.txt`,
    payment: {
      protocol: 'x402',
      version: 2,
      scheme: 'exact',
      network: ACTIVE_NETWORK,
      chain: ACTIVE_CHAIN,
      asset: 'USDC',
      asset_address: ACTIVE_CHAIN === 'abstract' ? ABSTRACT_USDC : BASE_USDC,
      settlement: 'per-request',
      facilitator: ACTIVE_FACILITATOR_URL,
    },
    endpoints: ENDPOINTS.map((ep) => ({
      name: ep.name,
      method: ep.method,
      url: `${BASE}${ep.path}`,
      price_usdc: ep.price_usdc,
      summary: ep.summary,
      example: ep.example_request,
    })),
  };

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
