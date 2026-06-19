import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { Metro } from './types';

type Sql = NeonQueryFunction<false, false>;

// A run claimed for execution: the crawl_runs row plus the metro it targets.
export interface ClaimedCrawlRun {
  runId: number;
  source: string;
  attempts: number;
  metro: Metro;
}

export interface EnqueueResult {
  enqueued: Array<{ runId: number; metroId: number; source: string }>;
  skipped: Array<{ metroId: number; source: string }>;
}

// A claimed run that hasn't completed within this window is presumed dead
// (e.g. the worker invocation was killed) and becomes claimable again.
export const DEFAULT_STUCK_AFTER_MINUTES = 15;
// Runs are retried until they hit this attempt count, then marked failed.
export const DEFAULT_MAX_ATTEMPTS = 3;

export function stuckAfterMinutes(): number {
  const v = Number(process.env.CRAWL_STUCK_AFTER_MINUTES);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_STUCK_AFTER_MINUTES;
}

export function maxAttempts(): number {
  const v = Number(process.env.CRAWL_MAX_ATTEMPTS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_MAX_ATTEMPTS;
}

/**
 * Enqueue one pending crawl run per metro+source. A metro+source that already
 * has a pending run is skipped so repeated triggers don't pile up a backlog.
 */
export async function enqueueCrawlRuns(
  sql: Sql,
  metros: Metro[],
  sources: string[],
): Promise<EnqueueResult> {
  const result: EnqueueResult = { enqueued: [], skipped: [] };

  for (const metro of metros) {
    for (const source of sources) {
      const rows = await sql`
        INSERT INTO crawl_runs (metro_id, source, status, stage)
        SELECT ${metro.id}, ${source}, 'pending', 'setup'
        WHERE NOT EXISTS (
          SELECT 1 FROM crawl_runs
          WHERE metro_id = ${metro.id} AND source = ${source} AND status = 'pending'
        )
        RETURNING id
      `;

      if (rows.length > 0) {
        result.enqueued.push({ runId: rows[0].id as number, metroId: metro.id, source });
      } else {
        result.skipped.push({ metroId: metro.id, source });
      }
    }
  }

  return result;
}

/**
 * Atomically claim the next executable run: either a pending run, or a
 * claimed-but-stalled running run whose worker presumably died. Single
 * statement with FOR UPDATE SKIP LOCKED so concurrent workers never claim
 * the same run. Returns null when there is nothing to do.
 */
export async function claimNextRun(sql: Sql): Promise<ClaimedCrawlRun | null> {
  const stuckMins = stuckAfterMinutes();
  const attempts = maxAttempts();

  const rows = await sql`
    UPDATE crawl_runs cr
    SET status = 'running',
        stage = 'setup',
        claimed_at = NOW(),
        attempts = cr.attempts + 1,
        error_message = NULL
    FROM metros m
    WHERE cr.id = (
      SELECT id FROM crawl_runs
      WHERE (
          status = 'pending'
          OR (
            status = 'running'
            AND COALESCE(claimed_at, started_at) < NOW() - make_interval(mins => ${stuckMins})
          )
        )
        AND attempts < ${attempts}
      ORDER BY started_at
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
      AND m.id = cr.metro_id
    RETURNING cr.id AS run_id, cr.source, cr.attempts,
              m.id AS metro_id, m.name, m.lat, m.lng, m.radius_mi, m.enabled
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    runId: row.run_id as number,
    source: row.source as string,
    attempts: row.attempts as number,
    metro: {
      id: row.metro_id as number,
      name: row.name as string,
      lat: Number(row.lat),
      lng: Number(row.lng),
      radius_mi: Number(row.radius_mi),
      enabled: row.enabled as boolean,
    },
  };
}

/**
 * Mark stalled runs that have exhausted their attempts as failed so they stop
 * blocking the queue view. Returns the number of runs failed.
 */
export async function failExhaustedRuns(sql: Sql): Promise<number> {
  const stuckMins = stuckAfterMinutes();
  const attempts = maxAttempts();

  const rows = await sql`
    UPDATE crawl_runs
    SET status = 'failed',
        error_message = 'Exceeded max attempts (' || attempts || ') without completing; presumed stuck',
        completed_at = NOW()
    WHERE status = 'running'
      AND COALESCE(claimed_at, started_at) < NOW() - make_interval(mins => ${stuckMins})
      AND attempts >= ${attempts}
    RETURNING id
  `;

  return rows.length;
}

export interface QueueStats {
  pending: number;
  running: number;
  oldestPendingAgeSeconds: number | null;
}

export async function queueStats(sql: Sql): Promise<QueueStats> {
  const rows = await sql`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending') AS pending,
      COUNT(*) FILTER (WHERE status = 'running') AS running,
      EXTRACT(EPOCH FROM NOW() - MIN(started_at) FILTER (WHERE status = 'pending')) AS oldest_pending_age
    FROM crawl_runs
  `;

  const row = rows[0];
  return {
    pending: Number(row.pending),
    running: Number(row.running),
    oldestPendingAgeSeconds:
      row.oldest_pending_age === null ? null : Math.round(Number(row.oldest_pending_age)),
  };
}
