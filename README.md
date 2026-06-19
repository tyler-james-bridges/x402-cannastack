# x402-cannastack

Agent-native cannabis data platform. Dispensary menus, prices, deals, and strain availability served through x402 micropayment endpoints.

## What is this?

The enterprise cannabis data market starts at $500/month. We're building the same data layer at $0.02/request with zero API keys, zero contracts, and instant access via the x402 payment protocol.

**Status:** Free preview -- all endpoints return real data at no cost. x402-ready for per-request USDC pricing when metering activates.

**Live endpoints:**

- `strain-finder` -- $0.02 -- Cross-dispensary strain search
- `price-compare` -- $0.02 -- Category price comparison across dispensaries
- `deal-scout` -- $0.02 -- Find dispensaries with active deals
- `price-history` -- $0.02 -- Track price changes over time

## Architecture

```
Vercel Cron (every 6h)
       |
   Crawler
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

## Web Preview

Live at [cannastack.0x402.sh](https://cannastack.0x402.sh).

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Type check
npx tsc --noEmit

# Smoke test: hit the strain-finder endpoint
curl -s -X POST http://localhost:3000/api/strain-finder \
  -H 'Content-Type: application/json' \
  -d '{"strain":"Blue Dream","location":"Phoenix, AZ"}' | head -c 200
```

## Machine-Readable Discovery

- [openapi.json](https://cannastack.0x402.sh/openapi.json) -- OpenAPI 3.1 spec
- [llms.txt](https://cannastack.0x402.sh/llms.txt) -- LLM-friendly endpoint descriptions
- [.well-known/x402.json](https://cannastack.0x402.sh/.well-known/x402.json) -- x402 payment metadata

## x402 API Usage

No API keys needed. Free preview now; pay per request with USDC via x402 when metering is active.

```bash
# Free preview: direct POST
curl -X POST https://cannastack.0x402.sh/api/strain-finder \
  -H 'Content-Type: application/json' \
  -d '{"strain": "Blue Dream", "location": "Phoenix, AZ"}'

# Compare flower prices in Los Angeles
curl -X POST https://cannastack.0x402.sh/api/price-compare \
  -H 'Content-Type: application/json' \
  -d '{"category": "flower", "location": "Los Angeles, CA"}'

# Find dispensary deals near Las Vegas
curl -X POST https://cannastack.0x402.sh/api/deal-scout \
  -H 'Content-Type: application/json' \
  -d '{"location": "Las Vegas, NV"}'

# x402 metered call (when active)
bankr x402 call https://x402.bankr.bot/0x72e45a93491a6acfd02da6ceb71a903f3d3b6d08/strain-finder \
  -d '{"strain": "Blue Dream", "location": "Phoenix, AZ"}'
```

## License

MIT
