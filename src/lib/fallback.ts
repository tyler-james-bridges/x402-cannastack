import { WeedmapsAdapter } from './adapters/weedmaps';
import type { RawDispensary, RawMenuItem } from './types';

const adapter = new WeedmapsAdapter();

export interface FallbackDispensary {
  id: number;
  name: string;
  slug: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  type: string;
  rating: number;
  reviews_count: number;
  has_deals: boolean;
  web_url: string;
  distance_mi: number;
  source_id: string;
}

export interface FallbackMenuItem {
  name: string;
  category: string;
  brand: string;
  genetics: string;
  description: string;
  price_unit: number | null;
  price_half_gram: number | null;
  price_gram: number | null;
  price_eighth: number | null;
  price_quarter: number | null;
  price_half_ounce: number | null;
  price_ounce: number | null;
  orderable: boolean;
  dispensary_id: number;
  dispensary_name: string;
  dispensary_rating: number;
  dispensary_reviews: number;
  dispensary_type: string;
  dispensary_address: string;
  dispensary_city: string;
  dispensary_url: string;
}

function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (n: number) => (n * Math.PI) / 180;
  const R = 3959; // miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapRawToDispensary(
  raw: RawDispensary,
  idx: number,
  centerLat: number,
  centerLng: number,
): FallbackDispensary {
  return {
    id: -(idx + 1), // negative IDs to distinguish from DB records
    name: raw.name,
    slug: raw.slug ?? '',
    address: raw.address ?? '',
    city: raw.city ?? '',
    state: raw.state ?? '',
    lat: raw.lat ?? 0,
    lng: raw.lng ?? 0,
    type: raw.type ?? '',
    rating: raw.rating ?? 0,
    reviews_count: raw.reviewsCount ?? 0,
    has_deals: raw.hasDeals ?? false,
    web_url: raw.webUrl ?? '',
    distance_mi: haversineDistance(
      centerLat,
      centerLng,
      raw.lat ?? 0,
      raw.lng ?? 0,
    ),
    source_id: raw.sourceId,
  };
}

function mapRawToMenuItem(
  item: RawMenuItem,
  disp: FallbackDispensary,
): FallbackMenuItem {
  return {
    name: item.name,
    category: item.category ?? '',
    brand: item.brand ?? 'Unknown',
    genetics: item.genetics ?? 'unknown',
    description: item.description ?? '',
    price_unit: item.priceUnit ?? null,
    price_half_gram: item.priceHalfGram ?? null,
    price_gram: item.priceGram ?? null,
    price_eighth: item.priceEighth ?? null,
    price_quarter: item.priceQuarter ?? null,
    price_half_ounce: item.priceHalfOunce ?? null,
    price_ounce: item.priceOunce ?? null,
    orderable: item.orderable ?? false,
    dispensary_id: disp.id,
    dispensary_name: disp.name,
    dispensary_rating: disp.rating,
    dispensary_reviews: disp.reviews_count,
    dispensary_type: disp.type,
    dispensary_address: disp.address,
    dispensary_city: disp.city,
    dispensary_url: disp.web_url,
  };
}

export async function fallbackFindDispensaries(
  lat: number,
  lng: number,
  radiusMi: number = 15,
): Promise<FallbackDispensary[]> {
  const rawDisps = await adapter.findDispensaries(lat, lng, radiusMi);
  return rawDisps.map((d, i) => mapRawToDispensary(d, i, lat, lng));
}

export async function fallbackSearchStrain(
  lat: number,
  lng: number,
  strain: string,
  radiusMi: number = 15,
): Promise<{ dispensaries: FallbackDispensary[]; items: FallbackMenuItem[] }> {
  const dispensaries = await fallbackFindDispensaries(lat, lng, radiusMi);
  if (dispensaries.length === 0) return { dispensaries: [], items: [] };

  const allItems: FallbackMenuItem[] = [];
  const strainLower = strain.toLowerCase();

  // Limit to top 10 dispensaries to avoid hammering the API
  const topDisps = dispensaries.slice(0, 10);

  for (const disp of topDisps) {
    const rawItems = await adapter.fetchMenu(disp.source_id);
    const matching = rawItems
      .filter((item) => item.name.toLowerCase().includes(strainLower))
      .map((item) => mapRawToMenuItem(item, disp));
    allItems.push(...matching);
  }

  return { dispensaries: topDisps, items: allItems };
}

export async function fallbackSearchCategory(
  lat: number,
  lng: number,
  categories: string[],
  genetics: string | null,
  radiusMi: number = 15,
  limit: number = 50,
): Promise<{ dispensaries: FallbackDispensary[]; items: FallbackMenuItem[] }> {
  const dispensaries = await fallbackFindDispensaries(lat, lng, radiusMi);
  if (dispensaries.length === 0) return { dispensaries: [], items: [] };

  const allItems: FallbackMenuItem[] = [];
  const catsLower = categories.map((c) => c.toLowerCase());
  const topDisps = dispensaries.slice(0, 10);

  for (const disp of topDisps) {
    const rawItems = await adapter.fetchMenu(disp.source_id);
    const matching = rawItems
      .filter((item) => {
        const catMatch = catsLower.includes((item.category ?? '').toLowerCase());
        if (!catMatch) return false;
        if (genetics) {
          return (item.genetics ?? '').toLowerCase() === genetics.toLowerCase();
        }
        return true;
      })
      .map((item) => mapRawToMenuItem(item, disp));
    allItems.push(...matching);
  }

  return { dispensaries, items: allItems.slice(0, limit) };
}

export async function fallbackSearchDeals(
  lat: number,
  lng: number,
  category: string | null,
  radiusMi: number = 15,
): Promise<{
  dispensaries: FallbackDispensary[];
  dealDisps: FallbackDispensary[];
  items: FallbackMenuItem[];
}> {
  const dispensaries = await fallbackFindDispensaries(lat, lng, radiusMi);
  if (dispensaries.length === 0) {
    return { dispensaries: [], dealDisps: [], items: [] };
  }

  const dealDisps = dispensaries.filter((d) => d.has_deals);
  const topDealDisps = dealDisps.slice(0, 10);

  const allItems: FallbackMenuItem[] = [];
  const catParts = category
    ? category.split(',').map((c) => c.trim().toLowerCase())
    : null;

  for (const disp of topDealDisps) {
    const rawItems = await adapter.fetchMenu(disp.source_id);
    const matching = rawItems
      .filter((item) => {
        if (!catParts) return true;
        return catParts.includes((item.category ?? '').toLowerCase());
      })
      .map((item) => mapRawToMenuItem(item, disp));
    allItems.push(...matching);
  }

  return { dispensaries, dealDisps: topDealDisps, items: allItems };
}
