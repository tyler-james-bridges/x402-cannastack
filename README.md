# Cannastack

Cannastack is a source-neutral API contract for processing caller-supplied menu snapshots. It normalizes menu structure, compares declared prices, and ranks items against exact caller-declared preferences.

Cannastack does not provide, crawl, fetch, verify, store, or redistribute third-party inventory. Processing is transient and does not write submitted menu data to application storage. Rights are caller-attested and unverified.

Results make no inventory, orderability, live availability, medical, or quality claims.

Payment verification uses an external facilitator, and settlement is a public transaction on Base. Payment authorization and settlement metadata therefore leave the menu-processing boundary. Published endpoint status describes the contract, not current network availability; readiness is evaluated on each request.

## Published endpoints

Each successfully paid request costs `$0.02` USDC through x402 exact settlement on Base (`eip155:8453`).

| Operation | Route | Purpose |
| --- | --- | --- |
| Normalize | `POST /api/v1/menu/normalize` | Canonicalize a caller-supplied menu snapshot. |
| Compare | `POST /api/v1/menu/compare` | Compare exact prices within caller-supplied menus. |
| Recommend | `POST /api/v1/menu/recommend` | Rank caller-supplied items by exact declared preferences. |

`src/lib/endpoints.ts` is the source of truth for endpoint prices, payment metadata, limits, and complete request and response JSON Schemas.

## Rights contract

Every request must include a `data_authorization` object matching the published schema. The caller must:

- Use data rights version `cannastack.data-rights.v1`.
- Identify the rights basis as `owner`, `license`, or `other_authorization`.
- Attest that `submitter_has_rights` is `true`.
- Confirm that `contains_personal_data` is `false`.

Cannastack does not verify these claims. A missing or invalid attestation returns an uncharged HTTP 403 before payment handling.

## File-based request

Prepare a caller-authorized, operation-specific file named `authorized-menu-request.json`. Its contents must satisfy the selected request schema. Cannastack does not publish sample inventory.

```bash
curl --include --request POST 'https://cannastack.0x402.sh/api/v1/menu/normalize' \
  --header 'content-type: application/json' \
  --data-binary @authorized-menu-request.json
```

A schema-valid unpaid request returns HTTP 402. The `PAYMENT-REQUIRED` header contains the base64-encoded x402 v2 challenge, and the JSON body contains the same challenge decoded. An x402 v2 capable client can authorize payment and retry the same URL and body. Success returns HTTP 200 with `PAYMENT-RESPONSE`.

Malformed, unauthorized, oversized, unsupported, and schema-invalid requests return uncharged HTTP 400, 403, 413, 415, or 422. Payment service and configuration failures return HTTP 502 or 503 without a processing result.

HTTP 502 with `error.code` set to `payment_settlement_indeterminate` means the original settlement could not be confirmed. Inspect `PAYMENT-RESPONSE` and the public onchain state. Do not create or submit a new payment authorization until the original is confirmed unsettled.

## Discovery

- `/openapi.json` publishes OpenAPI 3.1 paths, request and response schemas, validation responses, and x402 challenge compatibility.
- `/.well-known/x402.json` publishes a Cannastack service catalog with x402 metadata, schemas, and processing semantics. It is not an official x402 protocol manifest; the runtime HTTP 402 response is the payment challenge source.
- `/llms.txt` documents file-based use, rights attestation, payment flow, and legacy behavior.
- `/docs` provides the human-readable API reference.
- `/status` reports the published processor contract and disabled retrieval boundary without asserting network uptime.
- `GET /` with `Accept: application/json` returns the compact service catalog, versions, links, and source-neutral boundaries.

## Legacy routes

The former retrieval APIs remain retired. `/api/strain-finder`, `/api/price-compare`, `/api/deal-scout`, and `/api/price-history` return HTTP 410 Gone without an x402 payment challenge. Their human-readable pages link to the published bring-your-own-menu documentation.

## Development

```bash
npm install
npm run dev
```

Verification commands:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```
