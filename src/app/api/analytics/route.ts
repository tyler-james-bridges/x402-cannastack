// src/app/api/analytics/route.ts
// Extends your existing analytics route with the two fields the homepage
// meter + event stream need: settled USDC over the last 24h, and recent
// requests with city coordinates so the map can pin them.

import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Endpoint pricing — keep in sync with your x402 config.
const PRICE_USDC: Record<string, number> = {
  'strain-finder': 0.02,
  'price-compare': 0.02,
  'deal-scout': 0.02,
  'price-history': 0.02,
};

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
      // recent feeds the event stream + map; include lat/lng if you've added the columns,
      // otherwise the client falls back to a city dictionary.
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

    return NextResponse.json({
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
