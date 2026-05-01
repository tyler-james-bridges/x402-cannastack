import type { DataSourceAdapter, RawDispensary, RawMenuItem } from '../types';

// Leafly's consumer API endpoints (public-facing, no documented auth).
// These may require session cookies or API keys that aren't publicly available.
// If requests fail (403/401), the adapter returns empty arrays gracefully.
const DISPENSARY_SEARCH_URL =
  'https://consumer-api.leafly.com/api/dispensaries/v2/search';
const MENU_URL_BASE =
  'https://consumer-api.leafly.com/api/dispensary_menu/v2';

const HEADERS = {
  'User-Agent': 'x402-cannastack/1.0',
  Accept: 'application/json',
};

interface LeaflyDispensary {
  slug: string;
  name: string;
  city: string;
  state: string;
  address1: string;
  lat: number;
  lon: number;
  rating: number;
  reviewCount: number;
  type: string;
  featureFlags?: { hasDeals?: boolean };
}

interface LeaflyMenuItem {
  name: string;
  category: string;
  brandName: string;
  subtitle: string;
  pricing?: Record<string, number>;
  strain?: { genetics?: string };
  isOrderable?: boolean;
}

export class LeaflyAdapter implements DataSourceAdapter {
  name = 'leafly';

  async findDispensaries(
    lat: number,
    lng: number,
    radiusMi: number,
  ): Promise<RawDispensary[]> {
    try {
      const body = JSON.stringify({
        lat,
        lon: lng,
        radius: radiusMi,
        page: 0,
        take: 50,
      });

      const res = await fetch(DISPENSARY_SEARCH_URL, {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        console.error(
          `Leafly dispensary search failed: ${res.status} ${res.statusText}`,
        );
        return [];
      }

      const data = (await res.json()) as {
        stores?: LeaflyDispensary[];
        dispensaries?: LeaflyDispensary[];
      };
      const stores = data.stores ?? data.dispensaries ?? [];

      return stores.map((s) => ({
        source: 'leafly',
        sourceId: s.slug,
        name: s.name,
        slug: s.slug,
        address: s.address1 ?? '',
        city: s.city ?? '',
        state: s.state ?? '',
        lat: s.lat,
        lng: s.lon,
        type: s.type ?? 'dispensary',
        rating: s.rating ?? 0,
        reviewsCount: s.reviewCount ?? 0,
        hasDeals: s.featureFlags?.hasDeals ?? false,
        webUrl: `https://www.leafly.com/dispensary-info/${s.slug}`,
      }));
    } catch (err) {
      console.error('Leafly findDispensaries error:', err);
      return [];
    }
  }

  async fetchMenu(slug: string): Promise<RawMenuItem[]> {
    try {
      const res = await fetch(`${MENU_URL_BASE}/${slug}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        console.error(
          `Leafly menu fetch failed for ${slug}: ${res.status} ${res.statusText}`,
        );
        return [];
      }

      const data = (await res.json()) as {
        items?: LeaflyMenuItem[];
        menuItems?: LeaflyMenuItem[];
      };
      const items = data.items ?? data.menuItems ?? [];

      return items.map((i) => {
        const pricing = i.pricing ?? {};
        return {
          name: i.name,
          category: i.category ?? '',
          brand: i.brandName || undefined,
          genetics: i.strain?.genetics || undefined,
          description: i.subtitle || undefined,
          priceUnit: pricing.unit || pricing.each || undefined,
          priceHalfGram: pricing.halfGram || undefined,
          priceGram: pricing.gram || undefined,
          priceEighth: pricing.eighth || undefined,
          priceQuarter: pricing.quarter || undefined,
          priceHalfOunce: pricing.halfOunce || undefined,
          priceOunce: pricing.ounce || undefined,
          orderable: i.isOrderable ?? false,
        };
      });
    } catch (err) {
      console.error('Leafly fetchMenu error:', err);
      return [];
    }
  }
}
