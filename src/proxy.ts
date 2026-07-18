import { NextRequest, NextResponse } from 'next/server';
import { apiHeaders, preflight, retiredDataResponse } from '@/lib/api-response';
import { ENDPOINTS } from '@/lib/endpoints';
import {
  DATA_RIGHTS_VERSION,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
} from '@/lib/menu-contract';

const BASE = 'https://cannastack.0x402.sh';

const RETIRED_PAGES = new Set([
  '/strain-finder',
  '/price-compare',
  '/deal-scout',
  '/price-history',
]);

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && RETIRED_PAGES.has(pathname.slice(4))) {
    if (request.method === 'OPTIONS') return preflight();
    return retiredDataResponse();
  }

  if (RETIRED_PAGES.has(pathname)) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return retiredDataResponse();
    if (wantsJson(request)) return retiredDataResponse();
  }

  if (pathname === '/' && wantsJson(request)) {
    return NextResponse.json(
      {
        name: 'Cannastack',
        catalog_status: 'published',
        availability: 'not_asserted',
        payment_readiness: 'evaluated_per_request',
        description: 'Source-neutral processing for caller-supplied menu snapshots.',
        published_paid_endpoints: ENDPOINTS.length,
        endpoints: ENDPOINTS.map((endpoint) => ({
          name: endpoint.name,
          operation: endpoint.operation,
          method: endpoint.method,
          path: endpoint.path,
          url: `${BASE}${endpoint.path}`,
          summary: endpoint.summary,
          price: endpoint.price,
          price_usdc: endpoint.price_usdc,
          asset: endpoint.asset,
          network: endpoint.network,
          scheme: endpoint.scheme,
        })),
        versions: {
          api: 'v1',
          request_schema: MENU_SCHEMA_VERSION,
          data_rights: DATA_RIGHTS_VERSION,
          ruleset: MENU_RULESET_VERSION,
          x402: 2,
        },
        boundaries: {
          input: 'caller_supplied_menu_snapshots_only',
          authorization_status: 'caller_attested_unverified',
          rights_verification: 'not_performed',
          crawling: false,
          external_menu_fetch: false,
          external_menu_data_access: false,
          payment_network_access: true,
          payment_metadata: 'facilitator_and_public_onchain_settlement',
          application_storage: false,
          processing: 'transient_no_application_storage',
          inventory_verification: 'not_performed',
          third_party_inventory_provided: false,
          third_party_inventory_redistributed: false,
          claims: {
            inventory: false,
            orderability: false,
            live_availability: false,
            medical: false,
            quality: false,
          },
        },
        links: {
          docs: `${BASE}/docs`,
          openapi: `${BASE}/openapi.json`,
          llms_txt: `${BASE}/llms.txt`,
          x402_service_catalog: `${BASE}/.well-known/x402.json`,
          status: `${BASE}/status`,
        },
      },
      { headers: apiHeaders() },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/strain-finder',
    '/price-compare',
    '/deal-scout',
    '/price-history',
    '/api/strain-finder',
    '/api/price-compare',
    '/api/deal-scout',
    '/api/price-history',
  ],
};
