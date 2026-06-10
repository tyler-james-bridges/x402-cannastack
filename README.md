# x402-cannastack

Agent-native cannabis data platform. Dispensary menus, prices, deals, and strain availability served through x402 micropayment endpoints.

## What is this?

The enterprise cannabis data market starts at $500/month. We're building the same data layer at $0.02/request with zero API keys, zero contracts, and instant access via the x402 payment protocol.

**Endpoints in this app** (served at [cannastack.0x402.sh](https://cannastack.0x402.sh), paid via x402 on Abstract):

| Endpoint | Price | Description |
|----------|-------|-------------|
| `strain-finder` | $0.02 | Cross-dispensary strain search |
| `price-compare` | $0.02 | Category price comparison across dispensaries |
| `deal-scout` | $0.02 | Find dispensaries with active deals |
| `price-history` | $0.02 | Price trends over time for a strain or dispensary |

Related endpoints hosted separately on [Bankr Cloud](https://x402.bankr.bot) (not part of this codebase): `weedmaps-recs` ($0.03) and `night-out` ($0.05).

## Architecture

```
Vercel Cron (every 6h)
       |
   ETL Crawler
       |
       |
   Weedmaps
       |
  Neon Postgres
       |
  +----+----+----+
  |    |         |
 API  Web UI   Bankr
```

**Data sources:** Weedmaps public API (live). A Leafly adapter exists in `src/lib/adapters/leafly.ts` but is disabled in the crawl route until their public API access is confirmed.

**Stack:** Next.js, Neon Postgres, Vercel, Tailwind, x402/Bankr Cloud.

The crawler now follows a staged ETL shape: setup, extract, transform, load, and
cleanup. Each run is recorded in `crawl_runs`, per-item load/validation outcomes
are written to `crawl_item_events`, and stale items from completed dispensary
crawls are marked unavailable instead of silently lingering in search results.
See [docs/etl-ingestion.md](docs/etl-ingestion.md).

## Development

```bash
npm install
npm run dev
```

## Web Preview

Live at [cannastack.0x402.sh](https://cannastack.0x402.sh). Agent discovery surfaces: [/llms.txt](https://cannastack.0x402.sh/llms.txt), [/openapi.json](https://cannastack.0x402.sh/openapi.json), [/.well-known/x402.json](https://cannastack.0x402.sh/.well-known/x402.json).

## x402 API Usage

No API keys needed. Pay per request with USDC via x402.

```bash
# Find Blue Dream near Phoenix
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/strain-finder \
  -d '{"strain": "Blue Dream", "location": "Phoenix, AZ"}'

# Compare flower prices near Denver
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/price-compare \
  -d '{"category": "flower", "location": "Denver, CO"}'

# Find dispensary deals near LA
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/deal-scout \
  -d '{"location": "Los Angeles, CA"}'
```

## License

MIT
