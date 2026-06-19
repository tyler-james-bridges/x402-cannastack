# Cannastack Demo Test Plan

## Application Overview

Cannastack is a Next.js app that exposes cannabis menu intelligence to humans through a web UI and to agents through JSON discovery plus POST APIs. The demo suite should prove that a visitor can understand the product, run representative searches, and that an agent can discover endpoint contracts and receive structured validation errors.

## Seed

Use `seed.spec.ts` to open the app homepage and verify the main heading renders.

## Test Scenarios

### 1. Homepage Orientation

Steps:
1. Open `/`.
2. Verify the Cannastack brand and main heading are visible.
3. Verify the natural language prompt is visible.
4. Verify all four paid endpoints are listed with `$0.02` pricing.
5. Verify the docs link is available.

Expected results:
1. The page presents Cannastack as cannabis data priced like an API call.
2. The endpoint catalog includes `strain-finder`, `price-compare`, `deal-scout`, and `price-history`.

### 2. Natural Language Routing

Steps:
1. Open `/`.
2. Confirm the default prompt routes to `/strain-finder`.
3. Click the sample prompt `deals near Las Vegas`.
4. Confirm the routed endpoint changes to `/deal-scout`.
5. Enter text that cannot be parsed.

Expected results:
1. The endpoint chip updates before submit.
2. The run button disables for an unparsable prompt.

### 3. Homepage Preview Call Happy Path

Steps:
1. Mock `POST /api/strain-finder` with the documented example response.
2. Open `/`.
3. Submit the default prompt.

Expected results:
1. The response panel shows `200 OK`.
2. The result row and summary render.
3. The metered cost remains `$0.02`.

### 4. Docs Page Contract

Steps:
1. Open `/docs`.
2. Verify the quick start appears.
3. Verify each endpoint section is linkable and includes request parameters.
4. Verify the discovery links are present.

Expected results:
1. Human docs expose endpoint names, pricing, request examples, and discovery links.

### 5. Strain Finder Page Happy Path

Steps:
1. Mock `POST /api/strain-finder` with the documented example response.
2. Open `/strain-finder`.
3. Confirm the submit button is disabled before required fields are filled.
4. Enter `Blue Dream` and `Phoenix, AZ`.
5. Submit the form.

Expected results:
1. The result summary renders.
2. The best price result renders.

### 6. Price History Client Validation Sad Path

Steps:
1. Open `/price-history`.
2. Submit in strain mode with no strain.
3. Switch to dispensary mode and submit with no dispensary.

Expected results:
1. The page shows `Enter a strain name`.
2. The page shows `Enter a dispensary name`.

### 7. OpenAPI Agent Discovery

Steps:
1. Request `/openapi.json`.
2. Verify OpenAPI version and all paid endpoint paths.
3. Verify the x402 pricing extension is present.

Expected results:
1. Agents can discover the endpoint contract and price metadata from JSON.

### 8. x402 Manifest Agent Discovery

Steps:
1. Request `/.well-known/x402.json`.
2. Verify the payment protocol is `x402`.
3. Verify each endpoint advertises method, URL, price, and example request.

Expected results:
1. Agents can discover the machine-readable payment manifest.

### 9. API Validation Sad Path

Steps:
1. POST to `/api/strain-finder` without `strain`.
2. Inspect the status, headers, and JSON body.

Expected results:
1. The API returns `400`.
2. The body has `ok: false`, endpoint name, docs URL, and example request.
3. The response includes the `$0.02` price header.

### 10. API CORS Preflight

Steps:
1. Send `OPTIONS /api/strain-finder`.
2. Inspect status and CORS headers.

Expected results:
1. The API returns `204`.
2. The CORS headers allow POST requests and JSON content.
