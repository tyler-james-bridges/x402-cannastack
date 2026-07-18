import { ENDPOINTS } from '@/lib/endpoints';
import { discoveryHeaders } from '@/lib/api-response';
import {
  DATA_RIGHTS_VERSION,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
} from '@/lib/menu-contract';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

export async function GET() {
  const endpointLines = ENDPOINTS.map(
    (endpoint) =>
      `- ${endpoint.method} ${BASE}${endpoint.path}: ${endpoint.price} ${endpoint.asset} via x402 ${endpoint.scheme} on ${endpoint.network}. ${endpoint.summary}`,
  ).join('\n');

  const text = `# Cannastack

> Published, source-neutral processing contract for menu snapshots supplied by the caller.

## Service boundary

- Cannastack processes only the menu snapshot in the current request.
- Cannastack does not provide, crawl, fetch, verify, store, or redistribute third-party inventory.
- Processing is transient. Submitted menu data is not written to application storage, and processors do not fetch external menu data.
- Payment verification uses an external facilitator. Settlement is a public transaction on Base, so payment authorization and settlement metadata leave the processor boundary.
- Rights are caller-attested and unverified. Cannastack does not verify ownership, licenses, or other authorization.
- Results make no inventory, orderability, live availability, medical, or quality claims.

## Request contract

- Request schema version: ${MENU_SCHEMA_VERSION}.
- Data rights version: ${DATA_RIGHTS_VERSION}.
- Ruleset version: ${MENU_RULESET_VERSION}.
- Every request must include a data_authorization object that matches the selected endpoint schema.
- submitter_has_rights must be true, contains_personal_data must be false, and rights_basis must be owner, license, or other_authorization.
- A missing or invalid rights attestation returns uncharged HTTP 403 before payment handling.
- Full request and response JSON Schemas are in ${BASE}/openapi.json and ${BASE}/.well-known/x402.json.

## Input file

Prepare an operation-specific, caller-authorized JSON file named authorized-menu-request.json. Do not use data supplied by Cannastack. The file must satisfy the request schema for the selected operation.

\`\`\`sh
curl --include --request POST '${BASE}/api/v1/menu/normalize' \\
  --header 'content-type: application/json' \\
  --data-binary @authorized-menu-request.json
\`\`\`

The same file-based pattern applies to compare and recommend, using each operation's schema and URL.

## Payment flow

1. Submit a schema-valid JSON request to the selected endpoint.
2. Cannastack rejects malformed, unauthorized, oversized, unsupported, or schema-invalid requests with uncharged HTTP 400, 403, 413, 415, or 422.
3. A valid unpaid request returns HTTP 402. PAYMENT-REQUIRED contains the base64-encoded x402 v2 challenge, and the response body contains the same challenge decoded as JSON.
4. Use an x402 v2 capable client to authorize payment and retry the same URL and request body with its payment signature.
5. A successful paid request returns HTTP 200 and a PAYMENT-RESPONSE settlement header. Payment service or configuration failures return HTTP 502 or 503 without a processing result.
6. HTTP 502 with error code payment_settlement_indeterminate means the settlement outcome is unknown. Inspect PAYMENT-RESPONSE and the public onchain state. Do not create or submit a new payment authorization until the original is confirmed unsettled.

## Published endpoints

${endpointLines}

## Legacy routes

- /api/strain-finder, /api/price-compare, /api/deal-scout, and /api/price-history return HTTP 410 Gone without a payment challenge.
- /strain-finder, /price-compare, /deal-scout, and /price-history remain human-readable retirement pages that link to the published bring-your-own-menu documentation.

## Discovery

- OpenAPI: ${BASE}/openapi.json
- Cannastack x402 service catalog (not an official protocol manifest): ${BASE}/.well-known/x402.json
- Documentation: ${BASE}/docs
- Status: ${BASE}/status
`;

  return new Response(text, {
    headers: {
      ...discoveryHeaders('text/plain; charset=utf-8'),
    },
  });
}
