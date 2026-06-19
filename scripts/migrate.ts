import { config } from 'dotenv';
config({ path: '.env.local' });

// --optional: exit cleanly when DATABASE_URL is unset (local/CI builds without
// a database). The Vercel build runs `migrate --optional` before `next build`,
// so every deploy applies pending idempotent migrations to that environment's
// database before the new code serves traffic.
const optional = process.argv.includes('--optional');

async function migrate() {
  // Imported after dotenv so DATABASE_URL/NEON_HTTP_FETCH_ENDPOINT are loaded.
  const { getDb } = await import('../src/lib/db');
  const { runMigrations } = await import('../src/lib/migrations');

  if (!process.env.DATABASE_URL) {
    if (optional) {
      console.warn('migrate: DATABASE_URL not set — skipping (--optional)');
      return;
    }
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  console.log('Running migrations...');
  await runMigrations(getDb());
  console.log('Migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
