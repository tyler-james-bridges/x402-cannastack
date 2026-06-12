// Server-side fetch of the index stats for the homepage: rendered into the
// initial HTML (and the JSON-LD Dataset block) so crawlers and agents that
// don't run JS still see real figures. Soft-fails to null when the DB is
// unreachable (e.g. local builds without DATABASE_URL).

import { getDb } from './db';

export interface IndexSnapshot {
  totalMenuItems: number;
  totalDispensaries: number;
  totalPriceChanges: number;
  metros: { name: string; enabled: boolean }[];
  lastCrawl: string | null;
}

export async function fetchIndexSnapshot(): Promise<IndexSnapshot | null> {
  if (!process.env.DATABASE_URL) return null;
  try {
    const sql = getDb();
    const [stats, metros] = await Promise.all([
      sql`
        SELECT
          (SELECT COUNT(*) FROM menu_items) as total_menu_items,
          (SELECT COUNT(*) FROM dispensaries) as total_dispensaries,
          (SELECT COUNT(*) FROM price_history) as total_price_changes,
          GREATEST(
            (SELECT MAX(completed_at) FROM crawl_runs),
            (SELECT MAX(crawled_at) FROM menu_items)
          ) as last_crawl
      `,
      sql`SELECT name, enabled FROM metros ORDER BY id`,
    ]);
    const s = stats[0];
    return {
      totalMenuItems: Number(s.total_menu_items),
      totalDispensaries: Number(s.total_dispensaries),
      totalPriceChanges: Number(s.total_price_changes),
      metros: metros.map((m) => ({ name: m.name as string, enabled: m.enabled as boolean })),
      lastCrawl: s.last_crawl ? new Date(s.last_crawl as string).toISOString() : null,
    };
  } catch (err) {
    console.error('[index-snapshot] failed:', err);
    return null;
  }
}
