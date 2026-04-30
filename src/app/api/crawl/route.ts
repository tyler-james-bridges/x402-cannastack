import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { crawlMetro } from '@/lib/crawler';
import { WeedmapsAdapter } from '@/lib/adapters/weedmaps';
import type { Metro, CrawlResult } from '@/lib/types';

export const maxDuration = 300; // 5 min max for Vercel

export async function GET(req: NextRequest) {
  // Verify cron secret if set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }

  const sep = databaseUrl.includes('?') ? '&' : '?';
  const sql = neon(`${databaseUrl}${sep}options=-csearch_path%3Dcannastack%2Cpublic`);
  const weedmaps = new WeedmapsAdapter();

  // Get enabled metros
  const metros = (await sql`SELECT * FROM metros WHERE enabled = true ORDER BY id`) as Metro[];

  if (metros.length === 0) {
    return NextResponse.json({ ok: true, message: 'No enabled metros', results: [] });
  }

  const results: CrawlResult[] = [];

  for (const metro of metros) {
    try {
      const result = await crawlMetro(sql, metro, weedmaps);
      results.push(result);
    } catch (err) {
      console.error(`Crawl failed for ${metro.name}:`, err);
      results.push({
        metroId: metro.id,
        source: weedmaps.name,
        dispensariesFound: 0,
        itemsCrawled: 0,
        itemsNew: 0,
        itemsUpdated: 0,
        errors: 1,
        durationMs: 0,
      });
    }
  }

  const totalItems = results.reduce((s, r) => s + r.itemsCrawled, 0);
  const totalNew = results.reduce((s, r) => s + r.itemsNew, 0);
  const totalErrors = results.reduce((s, r) => s + r.errors, 0);

  return NextResponse.json({
    ok: true,
    metros: metros.length,
    totalItems,
    totalNew,
    totalErrors,
    results,
  });
}
