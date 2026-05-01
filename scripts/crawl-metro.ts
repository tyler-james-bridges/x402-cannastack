import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { crawlMetro } from '../src/lib/crawler';
import { WeedmapsAdapter } from '../src/lib/adapters/weedmaps';
import type { Metro } from '../src/lib/types';

config({ path: '.env.local' });

async function main() {
  const metroId = parseInt(process.argv[2] || '0', 10);
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);
  const weedmaps = new WeedmapsAdapter();

  let metros: Metro[];
  if (metroId > 0) {
    metros = (await sql`SELECT * FROM metros WHERE id = ${metroId} AND enabled = true`) as Metro[];
  } else {
    metros = (await sql`SELECT * FROM metros WHERE enabled = true ORDER BY id`) as Metro[];
  }

  if (metros.length === 0) {
    console.error('No matching metros found');
    process.exit(1);
  }

  for (const metro of metros) {
    await crawlMetro(sql, metro, weedmaps);
  }

  const stats = await sql`
    SELECT
      (SELECT COUNT(*) FROM dispensaries) as total_dispensaries,
      (SELECT COUNT(*) FROM menu_items) as total_items
  `;
  console.log('\nFinal stats:', stats[0]);
}

main().catch((err) => {
  console.error('Crawl failed:', err);
  process.exit(1);
});
