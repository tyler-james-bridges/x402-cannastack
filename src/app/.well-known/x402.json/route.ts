import { ENDPOINTS } from '@/lib/endpoints';
import { discoveryHeaders } from '@/lib/api-response';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

const boundaries = {
  input: 'caller_supplied_menu_snapshots_only',
  source_kind: 'caller_supplied',
  authorization_status: 'caller_attested_unverified',
  rights_verification: 'not_performed',
  crawling: false,
  external_menu_fetch: false,
  external_menu_data_access: false,
  external_menu_data_used: false,
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
};

export async function GET() {
  return Response.json(
    {
      name: 'Cannastack',
      catalog_format: 'cannastack.service-catalog.v1',
      catalog_status: 'published',
      availability: 'not_asserted',
      payment_readiness: 'evaluated_per_request',
      description:
        'Source-neutral processing for caller-supplied menu snapshots. Cannastack does not provide or retrieve third-party inventory.',
      homepage: BASE,
      docs: `${BASE}/docs`,
      openapi: `${BASE}/openapi.json`,
      llms_txt: `${BASE}/llms.txt`,
      status_page: `${BASE}/status`,
      published_paid_endpoints: ENDPOINTS.length,
      boundaries,
      payment: {
        protocol: 'x402',
        version: 2,
        settlement: 'per_request',
        challenge_source: 'runtime_http_402',
        official_protocol_manifest: false,
      },
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
        request_schema: endpoint.request_schema,
        response_schema: endpoint.response_schema,
        semantics: {
          source_kind: boundaries.source_kind,
          authorization_status: boundaries.authorization_status,
          external_menu_data_access: boundaries.external_menu_data_access,
          external_menu_data_used: boundaries.external_menu_data_used,
          processing: boundaries.processing,
          inventory_verification: boundaries.inventory_verification,
        },
      })),
    },
    { headers: discoveryHeaders() },
  );
}
