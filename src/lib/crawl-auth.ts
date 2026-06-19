import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

function authorized(req: NextRequest, cronSecret: string): boolean {
  const auth = req.headers.get('authorization') ?? '';
  const expected = Buffer.from(`Bearer ${cronSecret}`);
  const provided = Buffer.from(auth);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

/**
 * Crawl trigger/worker auth shared by /api/crawl and /api/crawl/worker.
 * Returns an error response to send, or null when the request is authorized.
 * Crawls are expensive (hammer source APIs) — never run them unauthenticated.
 */
export function requireCrawlAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: 'Crawl disabled: CRON_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (!authorized(req, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
