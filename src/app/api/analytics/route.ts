import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { apiHeaders, preflight } from '@/lib/api-response';
import { PRICE_USDC } from '@/lib/analytics-types';

export const OPTIONS = preflight;

export async function GET() {
  try {
    const sql = getDb();

    const [topEndpoints, topLocations, topStrains, recent, total, settled24h] = await Promise.all([
      sql`SELECT endpoint, count(*) as cnt, round(avg(response_ms)) as avg_ms
          FROM request_log GROUP BY endpoint ORDER BY cnt DESC`,
      sql`SELECT location_query, count(*) as cnt
          FROM request_log WHERE location_query IS NOT NULL
          GROUP BY location_query ORDER BY cnt DESC LIMIT 10`,
      sql`SELECT params->>'strain' as strain, count(*) as cnt
          FROM request_log WHERE endpoint = 'strain-finder' AND params->>'strain' IS NOT NULL
          GROUP BY params->>'strain' ORDER BY cnt DESC LIMIT 10`,
      // recent feeds the event stream + map; the client falls back to a city
      // dictionary for rows logged before lat/lng were recorded.
      sql`SELECT endpoint, location_query, params, results_count, response_ms,
                 created_at, lat AS location_lat, lng AS location_lng
          FROM request_log
          ORDER BY created_at DESC LIMIT 40`,
      sql`SELECT count(*) as cnt FROM request_log
          WHERE created_at > now() - interval '24 hours'`,
      sql`SELECT endpoint, count(*) as cnt FROM request_log
          WHERE created_at > now() - interval '24 hours' GROUP BY endpoint`,
    ]);

    const usdc24h = (settled24h as Array<Record<string, unknown>>).reduce(
      (s, r) => s + (PRICE_USDC[String(r.endpoint)] ?? 0.02) * Number(r.cnt),
      0,
    );

    return NextResponse.json(
      {
        ok: true,
        total_requests: Number(total[0].cnt),
        reqs_24h: (settled24h as Array<Record<string, unknown>>).reduce(
          (s, r) => s + Number(r.cnt),
          0,
        ),
        usdc_24h: Number(usdc24h.toFixed(2)),
        by_endpoint: topEndpoints,
        top_locations: topLocations,
        top_strains: topStrains,
        recent,
      },
      { headers: apiHeaders() },
    );
  } catch (err) {
    console.error('[analytics] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Analytics unavailable — check server logs.' },
      { status: 500, headers: apiHeaders() },
    );
  }
}
