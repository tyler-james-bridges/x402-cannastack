import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { requireCrawlAuth } from '@/lib/crawl-auth';
import { claimNextRun, failExhaustedRuns } from '@/lib/crawl-queue';
import { executeCrawlRun } from '@/lib/crawler';
import { getAdapterRegistry } from '@/lib/adapters';
import type { CrawlResult } from '@/lib/types';

export const maxDuration = 300; // 5 min max for Vercel

// Leave headroom inside maxDuration: stop claiming new runs once the budget
// is spent so the in-flight run can finish and the response can be sent.
const DEFAULT_BUDGET_MS = 240_000;

function budgetMs(): number {
  const v = Number(process.env.CRAWL_WORKER_BUDGET_MS);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_BUDGET_MS;
}

interface WorkerRunReport {
  runId: number;
  metro: string;
  source: string;
  attempt: number;
  status: 'success' | 'failed';
  error?: string;
  result?: CrawlResult;
}

export async function GET(req: NextRequest) {
  const denied = requireCrawlAuth(req);
  if (denied) return denied;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const sql = getDb();
  const adapters = getAdapterRegistry();
  const startMs = Date.now();
  const budget = budgetMs();

  const exhaustedFailed = await failExhaustedRuns(sql);
  const processed: WorkerRunReport[] = [];

  while (Date.now() - startMs < budget) {
    const claimed = await claimNextRun(sql);
    if (!claimed) break;

    const adapter = adapters[claimed.source];
    if (!adapter) {
      // A run for a source with no registered adapter can never execute.
      const message = `No adapter registered for source '${claimed.source}'`;
      await sql`
        UPDATE crawl_runs
        SET status = 'failed', error_message = ${message}, completed_at = NOW()
        WHERE id = ${claimed.runId}
      `;
      processed.push({
        runId: claimed.runId,
        metro: claimed.metro.name,
        source: claimed.source,
        attempt: claimed.attempts,
        status: 'failed',
        error: message,
      });
      continue;
    }

    try {
      const result = await executeCrawlRun(sql, claimed.runId, claimed.metro, adapter);
      processed.push({
        runId: claimed.runId,
        metro: claimed.metro.name,
        source: claimed.source,
        attempt: claimed.attempts,
        status: 'success',
        result,
      });
    } catch (err) {
      // executeCrawlRun already marked the run failed (terminal, not retried).
      // Reclaim/retry only applies to runs whose worker died mid-flight and
      // left the row 'running'. Failures here are run-level, not worker-level.
      processed.push({
        runId: claimed.runId,
        metro: claimed.metro.name,
        source: claimed.source,
        attempt: claimed.attempts,
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    exhaustedFailed,
    budgetMs: budget,
    elapsedMs: Date.now() - startMs,
    runs: processed,
  });
}
