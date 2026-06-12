/**
 * Minimal local stand-in for Neon's HTTP SQL endpoint, backed by plain
 * Postgres via `pg`. Lets the @neondatabase/serverless driver (and therefore
 * the whole app) run against a local database for development and tests:
 *
 *   1. start:  tsx scripts/neon-local-proxy.ts 4444 postgres://user:pw@localhost/db
 *   2. point the app at it: NEON_HTTP_FETCH_ENDPOINT=http://localhost:4444/sql
 *
 * Speaks the subset of the protocol the driver uses for single queries
 * (raw-text output, array mode). Batch/transaction queries are not supported.
 * Dev/test tool only — never expose this or use it in production.
 */
import http from 'node:http';
import { Pool, type PoolConfig } from 'pg';

// Return raw text values untouched; the neon driver applies pg type parsing
// client-side based on dataTypeID, mirroring Neon's real HTTP endpoint.
const rawTextTypes = { getTypeParser: () => (v: string) => v };

export interface NeonLocalProxy {
  url: string;
  close(): Promise<void>;
}

export function startNeonLocalProxy(
  port: number,
  pgConfig: string | PoolConfig,
): Promise<NeonLocalProxy> {
  const pool = new Pool(typeof pgConfig === 'string' ? { connectionString: pgConfig } : pgConfig);

  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST' || !req.url?.startsWith('/sql')) {
      res.writeHead(404).end();
      return;
    }

    let body = '';
    for await (const chunk of req) body += chunk;

    try {
      const parsed = JSON.parse(body) as { query?: string; params?: unknown[]; queries?: unknown };
      if (parsed.queries !== undefined || typeof parsed.query !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'neon-local-proxy: only single queries are supported' }));
        return;
      }

      const result = await pool.query({
        text: parsed.query,
        values: (parsed.params ?? []) as unknown[],
        rowMode: 'array',
        types: rawTextTypes,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          command: result.command,
          rowCount: result.rowCount ?? 0,
          fields: result.fields.map((f) => ({ name: f.name, dataTypeID: f.dataTypeID })),
          rows: result.rows,
        }),
      );
    } catch (err) {
      const e = err as Error & { code?: string; severity?: string; detail?: string };
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          message: e.message,
          code: e.code,
          severity: e.severity,
          detail: e.detail,
        }),
      );
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      resolve({
        url: `http://127.0.0.1:${port}/sql`,
        close: async () => {
          await new Promise<void>((res2) => server.close(() => res2()));
          await pool.end();
        },
      });
    });
  });
}

// Standalone mode: tsx scripts/neon-local-proxy.ts <port> <postgres-url>
if (process.argv[1]?.includes('neon-local-proxy')) {
  const port = Number(process.argv[2] || 4444);
  const pgUrl = process.argv[3] || process.env.LOCAL_PG_URL;
  if (!pgUrl) {
    console.error('Usage: tsx scripts/neon-local-proxy.ts <port> <postgres-url>');
    process.exit(1);
  }
  startNeonLocalProxy(port, pgUrl).then(
    (proxy) => console.log(`neon-local-proxy listening at ${proxy.url} -> ${pgUrl}`),
    (err) => {
      console.error('neon-local-proxy failed to start:', err);
      process.exit(1);
    },
  );
}
