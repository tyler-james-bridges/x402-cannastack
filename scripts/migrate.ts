import { config } from 'dotenv';
config({ path: '.env.local' });

async function migrate() {
  // Imported after dotenv so DATABASE_URL/NEON_HTTP_FETCH_ENDPOINT are loaded.
  const { getDb } = await import('../src/lib/db');
  const { runMigrations } = await import('../src/lib/migrations');

  if (!process.env.DATABASE_URL) {
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
