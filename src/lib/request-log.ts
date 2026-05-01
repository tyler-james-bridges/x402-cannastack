import type { NeonQueryFunction } from '@neondatabase/serverless';

export async function logRequest(
  sql: NeonQueryFunction<false, false>,
  endpoint: string,
  locationQuery: string | null,
  lat: number | null,
  lng: number | null,
  params: Record<string, unknown>,
  resultsCount: number,
  responseMs: number,
) {
  try {
    await sql`
      INSERT INTO request_log (endpoint, location_query, lat, lng, params, results_count, response_ms)
      VALUES (${endpoint}, ${locationQuery}, ${lat}, ${lng}, ${JSON.stringify(params)}, ${resultsCount}, ${responseMs})
    `;
  } catch {
    // Don't let logging failures break the response
  }
}
