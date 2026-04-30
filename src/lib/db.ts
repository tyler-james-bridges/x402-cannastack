import { neon } from '@neondatabase/serverless';

export function getDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const sep = databaseUrl.includes('?') ? '&' : '?';
  return neon(`${databaseUrl}${sep}options=-csearch_path%3Dcannastack%2Cpublic`);
}
