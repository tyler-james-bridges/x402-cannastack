// src/lib/analytics-types.ts
// Shared types for the homepage live data.

export type RecentRow = {
  endpoint: string;
  location_query: string | null;
  params: Record<string, unknown> | null;
  results_count: number | null;
  response_ms: number | null;
  created_at: string;
  location_lat: number | null;
  location_lng: number | null;
};

export type AnalyticsResponse = {
  ok: true;
  total_requests: number;
  reqs_24h: number;
  usdc_24h: number;
  by_endpoint: { endpoint: string; cnt: number; avg_ms: number }[];
  top_locations: { location_query: string; cnt: number }[];
  top_strains: { strain: string; cnt: number }[];
  recent: RecentRow[];
};

export const PRICE_USDC: Record<string, number> = {
  'strain-finder': 0.02,
  'price-compare': 0.02,
  'deal-scout': 0.02,
  'price-history': 0.02,
};

// Fallback city -> lat/lng dict so the map works before you backfill
// location_lat/location_lng on request_log. Add cities as you crawl them.
export const CITY_COORDS: Record<string, [number, number]> = {
  'denver, co': [39.74, -104.99],
  'phoenix, az': [33.45, -112.07],
  'los angeles, ca': [34.05, -118.24],
  'seattle, wa': [47.61, -122.33],
  'las vegas, nv': [36.17, -115.14],
  'detroit, mi': [42.33, -83.05],
  'new york, ny': [40.71, -74.00],
  'chicago, il': [41.88, -87.63],
  'portland, or': [45.51, -122.68],
  'austin, tx': [30.27, -97.74],
  'miami, fl': [25.76, -80.19],
  'boston, ma': [42.36, -71.06],
  'san francisco, ca': [37.77, -122.42],
};

export function coordsFor(row: RecentRow): [number, number] | null {
  if (row.location_lat != null && row.location_lng != null) {
    return [Number(row.location_lat), Number(row.location_lng)];
  }
  const k = (row.location_query || '').toLowerCase().trim();
  return CITY_COORDS[k] ?? null;
}
