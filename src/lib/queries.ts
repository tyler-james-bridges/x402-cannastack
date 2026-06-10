import type { NeonQueryFunction } from '@neondatabase/serverless';

// Haversine distance in miles between two lat/lng points
// Used as SQL expression for distance filtering
export function haversineSQL(lat: number, lng: number) {
  return `(3959 * acos(cos(radians(${lat})) * cos(radians(d.lat)) * cos(radians(d.lng) - radians(${lng})) + sin(radians(${lat})) * sin(radians(d.lat))))`;
}

export async function findNearbyDispensaries(
  sql: NeonQueryFunction<false, false>,
  lat: number,
  lng: number,
  radiusMi: number = 15,
) {
  // Use bounding box for rough filter, then haversine for exact distance
  const latDelta = radiusMi / 69.0;
  const lngDelta = radiusMi / (69.0 * Math.cos((lat * Math.PI) / 180));

  return sql`
    SELECT id, name, slug, address, city, state, lat, lng, type, rating, reviews_count, has_deals, web_url,
      (3959 * acos(
        cos(radians(${lat})) * cos(radians(lat)) * cos(radians(lng) - radians(${lng}))
        + sin(radians(${lat})) * sin(radians(lat))
      )) as distance_mi
    FROM dispensaries
    WHERE lat BETWEEN ${lat - latDelta} AND ${lat + latDelta}
      AND lng BETWEEN ${lng - lngDelta} AND ${lng + lngDelta}
    ORDER BY distance_mi ASC
  `;
}

export async function searchStrainInDB(
  sql: NeonQueryFunction<false, false>,
  strain: string,
  dispensaryIds: number[],
) {
  if (dispensaryIds.length === 0) return [];

  return sql`
    SELECT mi.name, mi.category, mi.brand, mi.genetics,
           mi.price_unit, mi.price_half_gram, mi.price_gram, mi.price_eighth,
           mi.price_quarter, mi.price_half_ounce, mi.price_ounce, mi.orderable,
           d.id as dispensary_id, d.name as dispensary_name, d.rating as dispensary_rating,
           d.reviews_count as dispensary_reviews, d.type as dispensary_type,
           d.address as dispensary_address, d.city as dispensary_city, d.web_url as dispensary_url
    FROM menu_items mi
    JOIN dispensaries d ON d.id = mi.dispensary_id
    WHERE mi.dispensary_id = ANY(${dispensaryIds})
      AND mi.available = true
      AND mi.name ILIKE ${'%' + strain + '%'}
    ORDER BY mi.price_eighth ASC NULLS LAST, mi.price_unit ASC NULLS LAST
  `;
}

export async function searchCategoryInDB(
  sql: NeonQueryFunction<false, false>,
  categories: string[],
  dispensaryIds: number[],
  genetics: string | null,
  limit: number = 50,
) {
  if (dispensaryIds.length === 0) return [];

  if (genetics) {
    return sql`
      SELECT mi.name, mi.category, mi.brand, mi.genetics,
             mi.price_unit, mi.price_half_gram, mi.price_gram, mi.price_eighth,
             mi.price_quarter, mi.price_half_ounce, mi.price_ounce, mi.orderable,
             d.name as dispensary_name, d.rating as dispensary_rating,
             d.web_url as dispensary_url
      FROM menu_items mi
      JOIN dispensaries d ON d.id = mi.dispensary_id
      WHERE mi.dispensary_id = ANY(${dispensaryIds})
        AND mi.available = true
        AND LOWER(mi.category) = ANY(${categories.map((c) => c.toLowerCase())})
        AND LOWER(mi.genetics) = ${genetics.toLowerCase()}
      ORDER BY mi.price_unit ASC NULLS LAST, mi.price_eighth ASC NULLS LAST
      LIMIT ${limit}
    `;
  }

  return sql`
    SELECT mi.name, mi.category, mi.brand, mi.genetics,
           mi.price_unit, mi.price_half_gram, mi.price_gram, mi.price_eighth,
           mi.price_quarter, mi.price_half_ounce, mi.price_ounce, mi.orderable,
           d.name as dispensary_name, d.rating as dispensary_rating,
           d.web_url as dispensary_url
    FROM menu_items mi
    JOIN dispensaries d ON d.id = mi.dispensary_id
    WHERE mi.dispensary_id = ANY(${dispensaryIds})
      AND mi.available = true
      AND LOWER(mi.category) = ANY(${categories.map((c) => c.toLowerCase())})
    ORDER BY mi.price_unit ASC NULLS LAST, mi.price_eighth ASC NULLS LAST
    LIMIT ${limit}
  `;
}

export async function searchDealsInDB(
  sql: NeonQueryFunction<false, false>,
  dispensaryIds: number[],
  category: string | null,
) {
  if (dispensaryIds.length === 0) return { dealDisps: [], allCount: 0 };

  const dealDisps = await sql`
    SELECT id, name, rating, reviews_count, type, address, city, web_url
    FROM dispensaries
    WHERE id = ANY(${dispensaryIds})
      AND has_deals = true
    ORDER BY rating DESC NULLS LAST, reviews_count DESC NULLS LAST
  `;

  if (dealDisps.length === 0) return { dealDisps: [], allCount: dispensaryIds.length };

  const dealIds = dealDisps.map((d) => d.id as number);

  let items;
  if (category) {
    items = await sql`
      SELECT mi.name, mi.category, mi.brand, mi.genetics,
             mi.price_unit, mi.price_eighth, mi.orderable, mi.dispensary_id
      FROM menu_items mi
      WHERE mi.dispensary_id = ANY(${dealIds})
        AND mi.available = true
        AND LOWER(mi.category) = ANY(${category.split(',').map((c) => c.trim().toLowerCase())})
      ORDER BY mi.price_unit ASC NULLS LAST
    `;
  } else {
    items = await sql`
      SELECT mi.name, mi.category, mi.brand, mi.genetics,
             mi.price_unit, mi.price_eighth, mi.orderable, mi.dispensary_id
      FROM menu_items mi
      WHERE mi.dispensary_id = ANY(${dealIds})
        AND mi.available = true
      ORDER BY mi.price_unit ASC NULLS LAST
    `;
  }

  return { dealDisps, items, allCount: dispensaryIds.length };
}
