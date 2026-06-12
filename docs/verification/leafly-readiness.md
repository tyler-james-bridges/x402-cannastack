# Leafly Adapter Readiness — 2026-06-12

## Status: implemented, parsing-tested, **disabled by default** — live API access unverified

The Leafly adapter (`src/lib/adapters/leafly.ts`) targets Leafly's consumer
API:

- `POST https://consumer-api.leafly.com/api/dispensaries/v2/search`
- `GET  https://consumer-api.leafly.com/api/dispensary_menu/v2/{slug}`

## What was verified

- **Parsing logic** is covered by `tests/leafly-adapter.test.ts`: store →
  `RawDispensary` mapping, pricing-key → price-ladder mapping (including the
  `each` → `priceUnit` fallback), empty-string fields becoming `undefined`,
  and graceful empty results on non-OK responses. Fixtures are synthetic,
  built from the response interfaces the adapter targets — they verify our
  mapping, **not** that Leafly's live responses still match those shapes.
- **Wiring**: the adapter is now registered in the crawl source registry
  behind `CRAWL_ENABLE_LEAFLY=1` (default OFF). Flipping it on requires a
  config change only, no code edit. When enabled, `/api/crawl` enqueues
  `leafly` runs alongside `weedmaps` and the worker executes them with the
  same queue semantics.

## What could NOT be verified (blocked)

Live probes of both endpoints were blocked by this environment's network
egress allowlist (`consumer-api.leafly.com` → `403 x-deny-reason:
host_not_allowed` from the egress proxy). It is therefore still unknown
whether Leafly's consumer API:

1. responds without session cookies / API keys,
2. still uses these paths, and
3. returns the field shapes the adapter expects.

## How to verify (from an unrestricted machine)

```bash
curl -s -X POST 'https://consumer-api.leafly.com/api/dispensaries/v2/search' \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -d '{"lat":33.4484,"lon":-112.074,"radius":20,"page":0,"take":5}' | head -c 2000
```

- If it returns JSON with a `stores` (or `dispensaries`) array: grab a `slug`
  and probe `GET .../api/dispensary_menu/v2/<slug>`, compare fields against
  the interfaces in `leafly.ts`, then set `CRAWL_ENABLE_LEAFLY=1` in Vercel.
- If it returns 401/403/HTML: access needs keys or is gated; leave the flag
  unset. The adapter logs the status and returns empty results, so a wrong
  flip degrades to empty crawls rather than corrupting data.
