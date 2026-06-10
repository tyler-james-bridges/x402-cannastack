# Cannastack ETL Ingestion Pattern

Cannastack should keep the Next.js API and x402 endpoints focused on reads. Crawling should behave like a staged ingestion job:

1. `setup` creates a `crawl_runs` row with source, metro, status, and counters.
2. `extract` fetches dispensaries and source menu payloads.
3. `transform` validates minimum required fields, builds stable external keys, and creates deterministic content hashes.
4. `load` idempotently upserts dispensaries and menu items, records price history when prices change, and writes `crawl_item_events`.
5. `cleanup` marks items missing from a completed dispensary crawl as unavailable and finalizes run metrics.

This mirrors the production-grade workflow shape without adopting a heavyweight orchestrator. Vercel cron can still call `/api/crawl`, but the database now records enough state to make runs observable, retryable, and debuggable.

## Current Boundaries

- Source adapters remain the provider boundary: `findDispensaries` plus `fetchMenu`.
- Reads continue using the existing `dispensaries`, `menu_items`, `price_history`, and `request_log` tables.
- The crawler records raw and transformed item events, but the read APIs do not depend on them.
- Failed item transforms do not fail the whole metro run.
- One failed dispensary fetch does not poison the rest of the metro crawl.

## Next Hardening Step

Move execution out of the Vercel request path once crawl volume grows:

- Keep `/api/crawl` as the authenticated trigger.
- Insert a queued job or `crawl_runs` row.
- Let a worker process claim and execute pending runs.

Good lightweight options are Trigger.dev, Inngest, BullMQ, Cloudflare Queues, or a small long-running Node worker. Temporal-style orchestration is only needed once runs require multi-hour durability, explicit activity retries, and operator controls.
