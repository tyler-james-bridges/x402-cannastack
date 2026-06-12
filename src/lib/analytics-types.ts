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

// Crawled metros keyed by lowercase metro name (matches scripts/seed-metros.ts).
// Drives the coverage layer on the homepage map.
export const METRO_COORDS: Record<string, [number, number]> = {
  'phoenix, az': [33.4484, -112.074],
  'los angeles, ca': [34.0522, -118.2437],
  'denver, co': [39.7392, -104.9903],
  'san francisco, ca': [37.7749, -122.4194],
  'san diego, ca': [32.7157, -117.1611],
  'seattle, wa': [47.6062, -122.3321],
  'portland, or': [45.5152, -122.6784],
  'chicago, il': [41.8781, -87.6298],
  'las vegas, nv': [36.1699, -115.1398],
  'detroit, mi': [42.3314, -83.0458],
  'boston, ma': [42.3601, -71.0589],
  'sacramento, ca': [38.5816, -121.4944],
  'tucson, az': [32.2226, -110.9747],
};

// Shape served by GET /api/crawl/status (free discovery endpoint).
export type CrawlStatusResponse = {
  ok: boolean;
  schema?: { migrated: boolean; missing_columns: string[] };
  metros?: { id: number; name: string; enabled: boolean }[];
  stats?: {
    total_dispensaries: string;
    total_menu_items: string;
    total_price_changes: string;
    unavailable_menu_items: string;
    failed_runs: string;
    last_crawl: string | null;
  };
  recentCrawls?: {
    id: number;
    metro_name: string;
    source: string;
    status: string;
    items_loaded: number | null;
    items_new: number | null;
    items_updated: number | null;
    completed_at: string | null;
    started_at: string;
  }[];
};
