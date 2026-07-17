import { pathToFileURL } from 'node:url';
import type { NeonQueryFunction } from '@neondatabase/serverless';

type Sql = NeonQueryFunction<false, false>;

export const PURGE_DERIVED_SQL = `
  TRUNCATE TABLE
    public.crawl_item_events,
    public.crawl_warnings,
    public.price_history,
    public.menu_items,
    public.crawl_runs,
    public.crawl_log,
    public.dispensaries,
    public.request_log
  RESTART IDENTITY
`;

export const PURGE_OPTIONAL_PAYMENT_SQL = `
  DO $purge$
  BEGIN
    IF to_regclass('public.payment_response_cache') IS NOT NULL
       AND to_regclass('public.payment_request_claims') IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE public.payment_response_cache, public.payment_request_claims RESTART IDENTITY';
    ELSIF to_regclass('public.payment_response_cache') IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE public.payment_response_cache RESTART IDENTITY';
    ELSIF to_regclass('public.payment_request_claims') IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE public.payment_request_claims RESTART IDENTITY';
    END IF;
  END;
  $purge$
`;

export async function purgeDerivedData(sql: Sql) {
  await sql.transaction([
    sql.query(PURGE_OPTIONAL_PAYMENT_SQL),
    sql.query(PURGE_DERIVED_SQL),
  ]);
}

export function hasPurgeConfirmation(args: string[]) {
  return args.includes('--confirm');
}

async function main() {
  if (!hasPurgeConfirmation(process.argv.slice(2))) {
    throw new Error('Refusing to purge without --confirm.');
  }

  const { config } = await import('dotenv');
  config({ path: '.env.local' });
  const { getDb } = await import('../src/lib/db');

  await purgeDerivedData(getDb());
  console.log('Derived cannabis data purged; metros and accounting data were preserved.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  });
}
