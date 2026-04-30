import type { DataSourceAdapter, RawDispensary, RawMenuItem } from '../types';

const DISCOVERY_URL = 'https://api-g.weedmaps.com/discovery/v2/listings';
const MENU_URL = 'https://api-g.weedmaps.com/wm/v1/listings';

const EXCLUDED_CATEGORIES = ['gear', 'accessories', 'apparel'];

interface WmListing {
  name: string;
  slug: string;
  wmid: number;
  city: string;
  state: string;
  address: string;
  latitude: number;
  longitude: number;
  type: string;
  rating: number;
  reviews_count: number;
  has_sale_items: boolean;
  web_url: string;
}

interface WmMenuItem {
  attributes: {
    name: string;
    category_name: string;
    brand_name: string;
    genetics: string;
    body: string;
    online_orderable: boolean;
    prices: {
      price_unit: number;
      price_half_gram: number;
      price_gram: number;
      price_eighth: number;
      price_quarter: number;
      price_half_ounce: number;
      price_ounce: number;
    };
  };
}

export class WeedmapsAdapter implements DataSourceAdapter {
  name = 'weedmaps';

  async findDispensaries(lat: number, lng: number, radiusMi: number): Promise<RawDispensary[]> {
    const params = new URLSearchParams({
      'filter[bounding_latlng]': `${lat},${lng}`,
      'filter[bounding_radius]': `${radiusMi}mi`,
      page_size: '50',
    });

    try {
      const res = await fetch(`${DISCOVERY_URL}?${params}`, {
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: { listings?: WmListing[] } };
      const listings = data.data?.listings ?? [];

      return listings.map((l) => ({
        source: 'weedmaps',
        sourceId: String(l.wmid),
        name: l.name,
        slug: l.slug,
        address: l.address,
        city: l.city,
        state: l.state,
        lat: l.latitude,
        lng: l.longitude,
        type: l.type,
        rating: l.rating,
        reviewsCount: l.reviews_count,
        hasDeals: l.has_sale_items,
        webUrl: l.web_url,
      }));
    } catch {
      return [];
    }
  }

  async fetchMenu(sourceId: string): Promise<RawMenuItem[]> {
    try {
      const res = await fetch(`${MENU_URL}/${sourceId}/menu_items?page_size=20`, {
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { data?: WmMenuItem[] };
      const items = data.data ?? [];

      return items
        .filter(
          (i) =>
            !EXCLUDED_CATEGORIES.includes(i.attributes.category_name?.toLowerCase() ?? ''),
        )
        .map((i) => ({
          name: i.attributes.name,
          category: i.attributes.category_name,
          brand: i.attributes.brand_name || undefined,
          genetics: i.attributes.genetics || undefined,
          description: i.attributes.body || undefined,
          priceUnit: i.attributes.prices?.price_unit || undefined,
          priceHalfGram: i.attributes.prices?.price_half_gram || undefined,
          priceGram: i.attributes.prices?.price_gram || undefined,
          priceEighth: i.attributes.prices?.price_eighth || undefined,
          priceQuarter: i.attributes.prices?.price_quarter || undefined,
          priceHalfOunce: i.attributes.prices?.price_half_ounce || undefined,
          priceOunce: i.attributes.prices?.price_ounce || undefined,
          orderable: i.attributes.online_orderable,
        }));
    } catch {
      return [];
    }
  }
}
