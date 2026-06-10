# x402-cannastack

Agent-native cannabis data platform. Dispensary menus, prices, deals, and strain availability served through x402 micropayment endpoints.

## What is this?

The enterprise cannabis data market starts at $500/month. We're building the same data layer at $0.02/request with zero API keys, zero contracts, and instant access via the x402 payment protocol.

**Live endpoints** on [Bankr Cloud](https://x402.bankr.bot):

| Endpoint | Price | Description |
|----------|-------|-------------|
| `weedmaps-recs` | $0.03 | Dispensary finder + product recommendations |
| `night-out` | $0.05 | Multi-source local planner (dispensaries + bars + restaurants + breweries) |
| `strain-finder` | $0.02 | Cross-dispensary strain search |
| `price-compare` | $0.02 | Category price comparison across dispensaries |
| `deal-scout` | $0.02 | Find dispensaries with active deals |

## Architecture

```
Vercel Cron (every 6h)
       |
   ETL Crawler
       |
  +----+----+
  |         |
Weedmaps  Leafly (planned)
  |         |
  +----+----+
       |
  Neon Postgres
       |
  +----+----+----+
  |    |         |
 API  Web UI   Bankr
```

**Data sources:** Weedmaps public API (live), Leafly (planned), more TBD.

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

Live at [cannastack.0x402.sh](https://cannastack.0x402.sh) (coming soon).

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
