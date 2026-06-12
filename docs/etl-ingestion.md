# Cannastack ETL Ingestion Pattern

Cannastack keeps the Next.js API and x402 endpoints focused on reads. Crawling
behaves like a staged ingestion job executed off the request path:

1. `setup` creates a `crawl_runs` row with source, metro, status, and counters.
2. `extract` fetches dispensaries and source menu payloads.
3. `transform` validates minimum required fields, builds stable external keys, and creates deterministic content hashes.
4. `load` idempotently upserts dispensaries and menu items, records price history when prices change, and writes `crawl_item_events`.
5. `cleanup` marks items missing from a completed dispensary crawl as unavailable and finalizes run metrics.

This mirrors the production-grade workflow shape without adopting a heavyweight
orchestrator: the queue is the `crawl_runs` table itself, claimed with plain
Postgres row locking. No external queue vendor is involved.

## Trigger / worker split

Execution is decoupled from the trigger:

- **`GET /api/crawl`** (Vercel cron, every 6h; `CRON_SECRET` auth) only
  *enqueues*: it inserts one `status='pending'` `crawl_runs` row per enabled
  metro × source and returns immediately. A metro+source that already has a
  pending run is skipped, so repeated triggers cannot pile up a backlog.
- **`GET /api/crawl/worker`** (Vercel cron, every 15min; same auth) *executes*:
  it claims runs one at a time and runs the staged ETL, looping until the queue
  is empty or its time budget (`CRAWL_WORKER_BUDGET_MS`, default 240s under a
  300s `maxDuration`) is spent. Leftover runs are picked up by the next worker
  invocation.
- **`npm run crawl:worker`** runs the same claim/execute loop from a shell or a
  long-running worker box, draining the queue once. The legacy `npm run crawl`
  scripts still execute metros directly (they create their run rows already
  claimed, so the worker never double-runs them).

### Claiming

A claim is a single atomic statement — safe under concurrent workers and with
the Neon HTTP driver (no multi-statement transaction needed):

```sql
UPDATE crawl_runs SET status='running', claimed_at=NOW(), attempts=attempts+1
WHERE id = (
  SELECT id FROM crawl_runs
  WHERE (status='pending'
         OR (status='running' AND COALESCE(claimed_at, started_at) < NOW() - <stuck window>))
    AND attempts < <max attempts>
  ORDER BY started_at LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING ...
```

### Failure semantics

- A run that **throws during execution** is marked `failed` (terminal, not
  retried) — same behavior as before the queue existed.
- A run whose **worker dies mid-flight** stays `running`; after
  `CRAWL_STUCK_AFTER_MINUTES` (default 15) it becomes claimable again and is
  re-executed from scratch. Loads are idempotent upserts keyed on stable item
  keys, so re-execution is safe.
- After `CRAWL_MAX_ATTEMPTS` (default 3) claims without completing, the run is
  marked `failed` with an explanatory `error_message` instead of looping
  forever.

`/api/crawl/status` reports the queue (`pending_runs`, `running_runs`,
`oldest_pending_at`) alongside per-run `attempts`/`claimed_at`.

## Current Boundaries

- Source adapters remain the provider boundary: `findDispensaries` plus `fetchMenu`,
  wired through the registry in `src/lib/adapters/index.ts`.
- Reads continue using the existing `dispensaries`, `menu_items`, `price_history`, and `request_log` tables.
- The crawler records raw and transformed item events, but the read APIs do not depend on them.
- Failed item transforms do not fail the whole metro run.
- One failed dispensary fetch does not poison the rest of the metro crawl.

## Local development and tests

`scripts/neon-local-proxy.ts` emulates Neon's HTTP SQL endpoint in front of a
plain local Postgres, so the whole app (and `tests/crawl-queue.test.ts`) can run
against a local database: start it and set
`NEON_HTTP_FETCH_ENDPOINT=http://localhost:4444/sql`. The queue tests skip
automatically when no local Postgres is reachable.

## Next Hardening Step

The cron-invoked worker route still executes inside a Vercel function. If crawl
volume outgrows the 5-minute function budget per pass, point a long-running
worker (running `npm run crawl:worker` on an interval or a LISTEN/NOTIFY loop)
at the same queue — the claim semantics already support multiple concurrent
workers. Temporal-style orchestration is only needed once runs require
multi-hour durability, explicit activity retries, and operator controls.
