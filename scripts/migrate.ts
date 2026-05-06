import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function migrate() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  console.log('Running migrations...');

  // Enable trigram extension for fuzzy search
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;

  // Metro areas we actively crawl
  await sql`
    CREATE TABLE IF NOT EXISTS metros (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      radius_mi INTEGER DEFAULT 15,
      enabled BOOLEAN DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Dispensaries (deduplicated across sources)
  await sql`
    CREATE TABLE IF NOT EXISTS dispensaries (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT,
      address TEXT,
      city TEXT,
      state TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      type TEXT,
      rating NUMERIC(3,2),
      reviews_count INTEGER,
      has_deals BOOLEAN DEFAULT false,
      web_url TEXT,
      last_crawled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(source, source_id)
    )
  `;

  // Menu items (the core data)
  await sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id SERIAL PRIMARY KEY,
      dispensary_id INTEGER REFERENCES dispensaries(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      source_item_id TEXT,
      source_item_key TEXT,
      name TEXT NOT NULL,
      category TEXT,
      brand TEXT,
      genetics TEXT,
      description TEXT,
      thc_pct NUMERIC(5,2),
      cbd_pct NUMERIC(5,2),
      price_unit NUMERIC(10,2),
      price_half_gram NUMERIC(10,2),
      price_gram NUMERIC(10,2),
      price_eighth NUMERIC(10,2),
      price_quarter NUMERIC(10,2),
      price_half_ounce NUMERIC(10,2),
      price_ounce NUMERIC(10,2),
      available BOOLEAN DEFAULT true,
      orderable BOOLEAN DEFAULT false,
      source_content_hash TEXT,
      last_seen_run_id INTEGER,
      raw_payload JSONB,
      crawled_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(dispensary_id, source, name, brand)
    )
  `;

  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS available BOOLEAN DEFAULT true`;
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS source_item_key TEXT`;
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS source_content_hash TEXT`;
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS last_seen_run_id INTEGER`;
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS raw_payload JSONB`;
  await sql`ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  // Durable ETL run state
  await sql`
    CREATE TABLE IF NOT EXISTS crawl_runs (
      id SERIAL PRIMARY KEY,
      metro_id INTEGER REFERENCES metros(id),
      source TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      stage TEXT NOT NULL DEFAULT 'setup',
      dispensaries_found INTEGER DEFAULT 0,
      items_extracted INTEGER DEFAULT 0,
      items_loaded INTEGER DEFAULT 0,
      items_new INTEGER DEFAULT 0,
      items_updated INTEGER DEFAULT 0,
      items_skipped INTEGER DEFAULT 0,
      items_stale INTEGER DEFAULT 0,
      warnings_count INTEGER DEFAULT 0,
      errors_count INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  // Per-item audit trail for extract/transform/load failures and idempotent loads
  await sql`
    CREATE TABLE IF NOT EXISTS crawl_item_events (
      id SERIAL PRIMARY KEY,
      crawl_run_id INTEGER REFERENCES crawl_runs(id) ON DELETE CASCADE,
      source TEXT NOT NULL,
      source_dispensary_id TEXT,
      source_item_key TEXT,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      raw_payload JSONB,
      transformed_payload JSONB,
      content_hash TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS crawl_warnings (
      id SERIAL PRIMARY KEY,
      crawl_run_id INTEGER REFERENCES crawl_runs(id) ON DELETE CASCADE,
      stage TEXT NOT NULL,
      source_id TEXT,
      item_name TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Price history (track changes over time)
  await sql`
    CREATE TABLE IF NOT EXISTS price_history (
      id SERIAL PRIMARY KEY,
      menu_item_id INTEGER REFERENCES menu_items(id) ON DELETE CASCADE,
      price_unit NUMERIC(10,2),
      price_eighth NUMERIC(10,2),
      price_gram NUMERIC(10,2),
      recorded_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Crawl log (monitoring)
  await sql`
    CREATE TABLE IF NOT EXISTS crawl_log (
      id SERIAL PRIMARY KEY,
      metro_id INTEGER REFERENCES metros(id),
      source TEXT NOT NULL,
      dispensaries_found INTEGER,
      items_crawled INTEGER,
      items_new INTEGER,
      items_updated INTEGER,
      errors INTEGER DEFAULT 0,
      duration_ms INTEGER,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    )
  `;

  // Request analytics
  await sql`
    CREATE TABLE IF NOT EXISTS request_log (
      id SERIAL PRIMARY KEY,
      endpoint TEXT NOT NULL,
      location_query TEXT,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      params JSONB,
      results_count INTEGER,
      response_ms INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_dispensaries_source ON dispensaries(source, source_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dispensaries_city ON dispensaries(city, state)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_dispensary ON menu_items(dispensary_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_menu_items_source_key ON menu_items(dispensary_id, source, source_item_key)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_genetics ON menu_items(genetics)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_seen_run ON menu_items(last_seen_run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_menu_items_name_trgm ON menu_items USING gin (name gin_trgm_ops)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_price_history_item ON price_history(menu_item_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crawl_log_metro ON crawl_log(metro_id, started_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crawl_runs_status ON crawl_runs(status, started_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crawl_runs_metro_source ON crawl_runs(metro_id, source, started_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crawl_item_events_run ON crawl_item_events(crawl_run_id, status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_crawl_warnings_run ON crawl_warnings(crawl_run_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_request_log_endpoint ON request_log(endpoint, created_at)`;

  console.log('Migrations complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
