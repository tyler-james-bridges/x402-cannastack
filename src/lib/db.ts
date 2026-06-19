import { neon, neonConfig, type NeonQueryFunction } from '@neondatabase/serverless';

export function getDb(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  // Local dev/test only: point the driver's HTTP endpoint at a proxy in front
  // of a plain Postgres (e.g. Neon's local proxy). Never set in production.
  if (process.env.NEON_HTTP_FETCH_ENDPOINT) {
    neonConfig.fetchEndpoint = process.env.NEON_HTTP_FETCH_ENDPOINT;
  }
  return neon(databaseUrl);
}
