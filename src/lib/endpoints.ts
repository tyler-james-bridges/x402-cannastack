export type EndpointSpec = {
  name: 'strain-finder' | 'price-compare' | 'deal-scout' | 'price-history';
  path: string;
  price_usdc: number;
  summary: string;
  method: 'POST';
  params: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    example: unknown;
  }[];
  example_request: Record<string, unknown>;
  example_response: Record<string, unknown>;
};

export const ENDPOINTS: EndpointSpec[] = [
  {
    name: 'strain-finder',
    path: '/api/strain-finder',
    price_usdc: 0.02,
    summary: 'Search a strain across every dispensary menu within range. Sorted cheapest first.',
    method: 'POST',
    params: [
      { name: 'strain', type: 'string', required: true, description: 'Strain name. Partial match supported.', example: 'Blue Dream' },
      { name: 'location', type: 'string', required: true, description: 'City, address, or "City, ST". US only.', example: 'Denver, CO' },
      { name: 'radius', type: 'number', required: false, description: 'Search radius in miles. Default 15, max 50.', example: 15 },
    ],
    example_request: { strain: 'Blue Dream', location: 'Denver, CO', radius: 15 },
    example_response: {
      ok: true,
      strain: 'Blue Dream',
      location: { query: 'Denver, CO', lat: 39.7392, lng: -104.9849, resolved: 'Denver, Colorado, USA' },
      source: 'database',
      dispensaries_searched: 24,
      results: [
        {
          dispensary: 'Native Roots',
          rating: 4.6,
          reviews: 1248,
          address: '1146 Broadway, Denver, CO',
          url: 'https://...',
          matches: [{ name: 'Blue Dream', category: 'flower', brand: 'House', genetics: 'hybrid', price: 28, orderable: true }],
        },
      ],
      summary: 'Searched 24 dispensaries near Denver, CO for "Blue Dream". Found 12 matches at 8 dispensaries. Cheapest: $28 at Native Roots.',
      response_ms: 612,
    },
  },
  {
    name: 'price-compare',
    path: '/api/price-compare',
    price_usdc: 0.02,
    summary: 'Compare prices for a category across every dispensary in range. Returns min/max/avg.',
    method: 'POST',
    params: [
      { name: 'category', type: 'string', required: true, description: 'flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness', example: 'flower' },
      { name: 'location', type: 'string', required: true, description: 'City, address, or "City, ST". US only.', example: 'Seattle, WA' },
      { name: 'genetics', type: 'string', required: false, description: 'Filter by genetics: sativa, indica, hybrid', example: 'sativa' },
      { name: 'radius', type: 'number', required: false, description: 'Search radius in miles. Default 15.', example: 15 },
      { name: 'limit', type: 'number', required: false, description: 'Max products to return. Default 50, max 100.', example: 50 },
    ],
    example_request: { category: 'flower', location: 'Seattle, WA', genetics: 'sativa', limit: 50 },
    example_response: {
      ok: true,
      category: 'flower',
      genetics: 'sativa',
      total_matches: 50,
      results: [{ name: 'Sour Diesel', brand: 'House', genetics: 'sativa', price: 22, unit: 'eighth', dispensary: 'Have a Heart', orderable: true }],
      stats: { min: 22, max: 65, avg: 41.3, count: 50 },
      summary: 'Compared 50 flower (sativa) products across 18 dispensaries near Seattle, WA. Cheapest: $22. Average: $41.30.',
      response_ms: 290,
    },
  },
  {
    name: 'deal-scout',
    path: '/api/deal-scout',
    price_usdc: 0.02,
    summary: 'Find dispensaries with active deals. Optionally filter by category.',
    method: 'POST',
    params: [
      { name: 'location', type: 'string', required: true, description: 'City, address, or "City, ST". US only.', example: 'Las Vegas, NV' },
      { name: 'category', type: 'string', required: false, description: 'Filter deals to one category (flower, vape, etc.)', example: 'flower' },
      { name: 'radius', type: 'number', required: false, description: 'Search radius in miles. Default 15.', example: 15 },
    ],
    example_request: { location: 'Las Vegas, NV', category: 'flower' },
    example_response: {
      ok: true,
      category: 'flower',
      total_dispensaries: 32,
      deals_dispensaries: 18,
      results: [
        {
          dispensary: 'Planet 13',
          rating: 4.7,
          address: '2548 W Desert Inn Rd, Las Vegas, NV',
          deal_products: [{ name: 'Sour Diesel', price: 18, brand: 'House' }],
        },
      ],
      summary: '18 of 32 dispensaries near Las Vegas, NV have active deals. Best value: Sour Diesel at $18 (Planet 13).',
      response_ms: 483,
    },
  },
  {
    name: 'price-history',
    path: '/api/price-history',
    price_usdc: 0.02,
    summary: 'Track price changes over time for a strain or dispensary. Returns trend up/down/stable.',
    method: 'POST',
    params: [
      { name: 'strain', type: 'string', required: false, description: 'Strain name (provide this OR dispensary)', example: 'Gelato 42' },
      { name: 'dispensary', type: 'string', required: false, description: 'Dispensary name (provide this OR strain)', example: 'Native Roots' },
      { name: 'location', type: 'string', required: false, description: 'Optional: scope to a city', example: 'Denver, CO' },
      { name: 'category', type: 'string', required: false, description: 'Filter by category', example: 'flower' },
      { name: 'days', type: 'number', required: false, description: 'Lookback window in days. Default 30, max 365.', example: 30 },
    ],
    example_request: { strain: 'Gelato 42', days: 30 },
    example_response: {
      ok: true,
      query: { strain: 'Gelato 42', days: 30 },
      history: [{ item_name: 'Gelato 42', dispensary_name: 'Native Roots', price_eighth: 28, recorded_at: '2026-05-10T14:22:00Z' }],
      stats: { current: 28, oldest: 32, change_pct: -12.5, trend: 'down', data_points: 14 },
      summary: '14 price changes in the last 30 days. Current: $28. Trend: down (-12.5%).',
      response_ms: 81,
    },
  },
];

export function findEndpoint(name: string): EndpointSpec | undefined {
  return ENDPOINTS.find((e) => e.name === name);
}
