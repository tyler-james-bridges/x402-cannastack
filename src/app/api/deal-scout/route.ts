import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchDealsInDB } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';
import { getCached, setCache } from '@/lib/cache';
import { fallbackSearchDeals } from '@/lib/fallback';

const CATEGORY_MAP: Record<string, string> = {
  flower: 'flower',
  edibles: 'edibles',
  edible: 'edibles',
  vape: 'vape pens',
  vapes: 'vape pens',
  concentrate: 'concentrates',
  concentrates: 'concentrates',
  'pre-roll': 'pre-rolls,pre roll,infused pre roll',
  'pre-rolls': 'pre-rolls,pre roll,infused pre roll',
  preroll: 'pre-rolls,pre roll,infused pre roll',
  drink: 'drinks',
  drinks: 'drinks',
  tincture: 'tinctures',
  tinctures: 'tinctures',
  topical: 'topicals',
  topicals: 'topicals',
  wellness: 'wellness',
};

function bestPrice(row: Record<string, unknown>): number {
  if (Number(row.price_unit) > 0) return Number(row.price_unit);
  if (Number(row.price_eighth) > 0) return Number(row.price_eighth);
  return 0;
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const location = body.location?.trim();

    if (!location) {
      return NextResponse.json({ ok: false, error: "Missing 'location'" }, { status: 400 });
    }

    const categoryInput = body.category?.trim().toLowerCase() ?? null;
    const radiusMi = parseInt(body.radius || '15', 10) || 15;

    let targetCategory: string | null = null;
    if (categoryInput) {
      targetCategory = CATEGORY_MAP[categoryInput] ?? null;
      if (!targetCategory) {
        return NextResponse.json(
          {
            ok: false,
            error: `Unknown category: ${categoryInput}. Options: flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness`,
          },
          { status: 400 },
        );
      }
    }

    // Check cache
    const sortedParams = JSON.stringify({
      category: categoryInput,
      location,
      radius: radiusMi,
    });
    const cacheKey = `deal-scout:${sortedParams}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, response_ms: Date.now() - startMs });
    }

    const geo = await geocode(location);
    if (!geo) {
      return NextResponse.json(
        { ok: false, error: `Could not geocode: ${location}` },
        { status: 400 },
      );
    }

    const sql = getDb();
    const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, radiusMi);

    let source: 'database' | 'live' = 'database';

    if (dispensaries.length === 0) {
      // Fallback to live Weedmaps data
      source = 'live';
      const fallback = await fallbackSearchDeals(geo.lat, geo.lng, targetCategory, radiusMi);

      if (fallback.dispensaries.length === 0) {
        const responseData = {
          ok: true,
          location: {
            query: location,
            lat: geo.lat,
            lng: geo.lng,
            resolved: geo.display_name,
          },
          source,
          category: categoryInput || 'all',
          total_dispensaries: 0,
          deals_dispensaries: 0,
          results: [],
          summary: `No dispensaries found within ${radiusMi} miles of ${location}.`,
          response_ms: Date.now() - startMs,
        };
        return NextResponse.json(responseData);
      }

      const results = fallback.dealDisps.map((disp) => {
        const dispItems = fallback.items
          .filter((i) => i.dispensary_id === disp.id)
          .slice(0, 10)
          .map((item) => ({
            name: item.name,
            category: item.category || '',
            brand: item.brand || 'Unknown',
            genetics: item.genetics || 'unknown',
            price: bestPrice(item as unknown as Record<string, unknown>),
            orderable: item.orderable,
          }));

        return {
          dispensary: disp.name,
          rating: disp.rating,
          reviews: disp.reviews_count,
          type: disp.type || '',
          address: disp.address || '',
          city: disp.city || '',
          url: disp.web_url || '',
          deal_products: dispItems,
        };
      });

      const totalProducts = results.reduce((sum, r) => sum + r.deal_products.length, 0);

      let summary = `${fallback.dealDisps.length} of ${fallback.dispensaries.length} dispensaries near ${location} have active deals.`;
      if (categoryInput) {
        summary += ` Found ${totalProducts} ${categoryInput} products at deal dispensaries.`;
      } else {
        summary += ` Found ${totalProducts} products at deal dispensaries.`;
      }
      summary += ' (live data)';

      const responseMs = Date.now() - startMs;
      logRequest(
        sql,
        'deal-scout',
        location,
        geo.lat,
        geo.lng,
        { category: categoryInput, source },
        totalProducts,
        responseMs,
      );

      const responseData = {
        ok: true,
        location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
        source,
        category: categoryInput || 'all',
        total_dispensaries: fallback.dispensaries.length,
        deals_dispensaries: fallback.dealDisps.length,
        results,
        summary,
        response_ms: responseMs,
      };

      setCache(cacheKey, responseData);
      return NextResponse.json(responseData);
    }

    // DB path (existing logic)
    const dispIds = dispensaries.map((d) => d.id as number);
    const { dealDisps, items, allCount } = await searchDealsInDB(sql, dispIds, targetCategory);

    const results = dealDisps.map((disp) => {
      const dispItems = (items || [])
        .filter((i) => i.dispensary_id === disp.id)
        .slice(0, 10)
        .map((item) => ({
          name: item.name as string,
          category: (item.category as string) || '',
          brand: (item.brand as string) || 'Unknown',
          genetics: (item.genetics as string) || 'unknown',
          price: bestPrice(item),
          orderable: item.orderable as boolean,
        }));

      return {
        dispensary: disp.name as string,
        rating: Number(disp.rating) || 0,
        reviews: Number(disp.reviews_count) || 0,
        type: (disp.type as string) || '',
        address: (disp.address as string) || '',
        city: (disp.city as string) || '',
        url: (disp.web_url as string) || '',
        deal_products: dispItems,
      };
    });

    const totalProducts = results.reduce((sum, r) => sum + r.deal_products.length, 0);

    let summary = `${dealDisps.length} of ${allCount} dispensaries near ${location} have active deals.`;
    if (categoryInput) {
      summary += ` Found ${totalProducts} ${categoryInput} products at deal dispensaries.`;
    } else {
      summary += ` Found ${totalProducts} products at deal dispensaries.`;
    }
    if (results[0] && results[0].deal_products[0]) {
      const best = results[0].deal_products.sort(
        (a, b) => (a.price || Infinity) - (b.price || Infinity),
      )[0];
      if (best.price > 0) {
        summary += ` Best value: ${best.name} at $${best.price} (${results[0].dispensary}).`;
      }
    }

    const responseMs = Date.now() - startMs;
    logRequest(
      sql,
      'deal-scout',
      location,
      geo.lat,
      geo.lng,
      { category: categoryInput, source },
      totalProducts,
      responseMs,
    );

    const responseData = {
      ok: true,
      location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
      source,
      category: categoryInput || 'all',
      total_dispensaries: allCount,
      deals_dispensaries: dealDisps.length,
      results,
      summary,
      response_ms: responseMs,
    };

    setCache(cacheKey, responseData);
    return NextResponse.json(responseData);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
