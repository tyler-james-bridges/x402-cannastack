# Demo Runbook -- CannaStack Livestream

Repeatable demo script for CannaStack x402 livestream presentations.

## Pre-Stream Verification Checklist

Run these before going live:

```bash
# 1. Verify the app is deployed and responding
curl -s https://cannastack.0x402.sh/api/strain-finder \
  -X POST -H 'Content-Type: application/json' \
  -d '{"strain":"Blue Dream","location":"Phoenix, AZ"}' | head -c 200

# 2. Verify deal-scout works
curl -s https://cannastack.0x402.sh/api/deal-scout \
  -X POST -H 'Content-Type: application/json' \
  -d '{"location":"Las Vegas, NV"}' | head -c 200

# 3. Verify price-compare works
curl -s https://cannastack.0x402.sh/api/price-compare \
  -X POST -H 'Content-Type: application/json' \
  -d '{"category":"flower","location":"Los Angeles, CA"}' | head -c 200

# 4. Verify price-history works
curl -s https://cannastack.0x402.sh/api/price-history \
  -X POST -H 'Content-Type: application/json' \
  -d '{"strain":"Gelato"}' | head -c 200

# 5. Verify machine-readable endpoints
curl -s https://cannastack.0x402.sh/llms.txt | head -5
curl -s https://cannastack.0x402.sh/openapi.json | head -5
curl -s https://cannastack.0x402.sh/.well-known/x402.json | head -5

# 6. Verify homepage loads
curl -s -o /dev/null -w "%{http_code}" https://cannastack.0x402.sh
```

## Browser Tabs to Preload

Open these tabs in order before the stream:

1. Homepage: https://cannastack.0x402.sh
2. Docs: https://cannastack.0x402.sh/docs
3. Status: https://cannastack.0x402.sh/status
4. llms.txt: https://cannastack.0x402.sh/llms.txt
5. OpenAPI: https://cannastack.0x402.sh/openapi.json
6. x402 manifest: https://cannastack.0x402.sh/.well-known/x402.json

## Demo Sequence

### Act 1: The Problem (2 min)

"Cannabis data is expensive. Enterprise APIs charge $500+/month just to access dispensary menus. If you're building an AI agent that needs real-time pricing, you're locked out unless you sign a contract. We built CannaStack to change that -- every dispensary menu, price, and deal across the US, priced like an API call, not a contract."

### Act 2: Live Query -- Strain Finder (3 min)

1. Switch to homepage tab
2. The default query is pre-filled: "find Blue Dream near Phoenix"
3. Click RUN
4. Walk through the result panel:
   - "Real dispensaries, real prices, real-time data"
   - Point out endpoint, cost, source, response time in the metadata bar
   - "This is a preview call -- the x402 payment layer is ready to activate"

### Act 3: Different Endpoint -- Deal Scout (2 min)

1. Click the "deals near Las Vegas" chip
2. Click RUN
3. "Same interface, different endpoint. deal-scout finds dispensaries with active deals. Every query costs $0.02 when metering is live."

### Act 4: Machine-Readable Discovery (3 min)

1. Switch to llms.txt tab
   - "Any LLM can read this and understand what our API does"
2. Switch to openapi.json tab
   - "Standard OpenAPI spec -- works with any API client"
3. Switch to x402 manifest tab
   - "This is the x402 payment manifest. It tells wallet-capable clients exactly how to pay for each endpoint. No API keys, no OAuth, no signup."

### Act 5: Terminal Demo (2 min)

Run this curl command live:

```bash
curl -s -X POST https://cannastack.0x402.sh/api/strain-finder \
  -H 'Content-Type: application/json' \
  -d '{"strain":"Blue Dream","location":"Phoenix, AZ"}' | python3 -m json.tool | head -30
```

"That's it. One POST, real data, no authentication. When x402 metering activates, the same call goes through a payment gateway -- your agent's wallet pays $0.02 in USDC and gets the same response."

### Act 6: Roadmap Close (1 min)

- More data sources (Leafly, Dutchie)
- More metros (currently 13 US metros crawled)
- x402 payment activation via Bankr Cloud
- Agent-to-agent discovery: any AI agent can find, understand, and pay for cannabis data autonomously

## Fallback Queries

If a primary query returns empty or errors, use these alternatives:

- Primary: "find Blue Dream near Phoenix" -> Fallback: "find OG Kush near Phoenix"
- Primary: "deals near Las Vegas" -> Fallback: "deals near Los Angeles"
- Primary: "find Wedding Cake in Los Angeles" -> Fallback: "find Sour Diesel in Los Angeles"
- Primary: "cheapest pre-rolls in Phoenix" -> Fallback: "cheapest flower in Phoenix"
- Primary: "has Gelato dropped this week" -> Fallback: "has Blue Dream dropped this week"

## Language Guide

### DO NOT Say (unless payment is verified working)

- "settled"
- "paid"
- "charged"
- "revenue"
- "USDC collected"
- "earning" / "making money"

### DO Say

- "preview mode" -- current state, free access
- "x402-ready" -- payment infrastructure is built, ready to activate
- "metered value" -- tracking what queries would cost
- "per-request pricing ready to activate"
- "free preview" -- what users get right now
- "when metering activates" -- future tense for payment
- "$0.02 per query" -- the target price point

## Timing

Total demo time: ~13 minutes. Leave 5 min for Q&A if in a live session.
