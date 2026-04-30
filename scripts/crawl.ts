import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { crawlMetro } from '../src/lib/crawler';
import { WeedmapsAdapter } from '../src/lib/adapters/weedmaps';
import type { Metro } from '../src/lib/types';

config({ path: '.env.local' });

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const weedmaps = new WeedmapsAdapter();

  const metros = (await sql`SELECT * FROM metros WHERE enabled = true ORDER BY id`) as Metro[];
  console.log(`Found ${metros.length} enabled metros`);

  for (const metro of metros) {
    try {
      await crawlMetro(sql, metro, weedmaps);
    } catch (err) {
      console.error(`Crawl failed for ${metro.name}:`, err);
    }
  }

  // Print summary
  const stats = await sql`
    SELECT
      (SELECT COUNT(*) FROM dispensaries) as total_dispensaries,
      (SELECT COUNT(*) FROM menu_items) as total_items,
      (SELECT COUNT(*) FROM price_history) as price_changes
  `;
  console.log('\nFinal stats:', stats[0]);
}

main().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});
