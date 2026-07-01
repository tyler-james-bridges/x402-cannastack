import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchDealsInDB } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';
import { getCached, setCache } from '@/lib/cache';
import { fallbackSearchDeals } from '@/lib/fallback';
import { ok, preflight, badRequest, internalError } from '@/lib/api-response';
import { CATEGORY_MAP, CATEGORY_OPTIONS } from '@/lib/categories';
import { bestPriceValue } from '@/lib/pricing';
import { clampInt, MAX_RADIUS_MI } from '@/lib/validate';
import { withPayment } from '@/lib/x402';
import { nextForDealScout } from '@/lib/next-actions';

export const OPTIONS = preflight;

async function handler(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const location = body.location?.trim();

    if (!location) {
      return badRequest("Missing required parameter 'location'", 'deal-scout');
    }

    const categoryInput = body.category?.trim().toLowerCase() ?? null;
    const radiusMi = clampInt(body.radius, 15, 1, MAX_RADIUS_MI);

    let targetCategories: string[] | null = null;
    if (categoryInput) {
      targetCategories = CATEGORY_MAP[categoryInput] ?? null;
      if (!targetCategories) {
        return badRequest(
          `Unknown category: "${categoryInput}". Options: ${CATEGORY_OPTIONS}`,
          'deal-scout',
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
      const responseMs = Date.now() - startMs;
      return ok(
        { ...cached, cached: true, response_ms: responseMs },
        { endpoint: 'deal-scout', cache: 'hit', source: 'cache', responseMs },
      );
    }

    const geo = await geocode(location);
    if (!geo) {
      return badRequest(`Could not geocode location: "${location}". Use a US city, address, or "City, ST".`, 'deal-scout');
    }

    const sql = getDb();
    const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, radiusMi);
    const dispMeta = new Map<number, { distance_mi?: number; active_deal?: boolean }>(
      dispensaries.map((d) => [
        Number(d.id),
        { distance_mi: Number(d.distance_mi) || undefined, active_deal: Boolean(d.has_deals) },
      ]),
    );

    let source: 'database' | 'live' = 'database';

    if (dispensaries.length === 0) {
      // Fallback to live Weedmaps data
      source = 'live';
      const fallback = await fallbackSearchDeals(geo.lat, geo.lng, targetCategories, radiusMi);

      if (fallback.dispensaries.length === 0) {
        const responseMs = Date.now() - startMs;
        return ok(
          {
            ok: true,
            location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
            source,
            category: categoryInput || 'all',
            total_dispensaries: 0,
            deals_dispensaries: 0,
            results: [],
            summary: `No dispensaries found within ${radiusMi} miles of ${location}.`,
            response_ms: responseMs,
          },
          { endpoint: 'deal-scout', source: 'live', cache: 'miss', responseMs },
        );
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
            price: bestPriceValue(item as unknown as Record<string, unknown>),
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
          distance_mi: Number(disp.distance_mi) || undefined,
          active_deal: true,
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
        next_actions: nextForDealScout({
          location,
          category: categoryInput || undefined,
          bestProductName: results[0]?.deal_products?.[0]?.name,
        }),
        response_ms: responseMs,
      };

      setCache(cacheKey, responseData);
      return ok(responseData, { endpoint: 'deal-scout', source: 'live', cache: 'miss', responseMs });
    }

    // DB path (existing logic)
    const dispIds = dispensaries.map((d) => d.id as number);
    const { dealDisps, items, allCount } = await searchDealsInDB(sql, dispIds, targetCategories);

    const results = dealDisps.map((disp) => {
      const dispItems = (items || [])
        .filter((i) => i.dispensary_id === disp.id)
        .slice(0, 10)
        .map((item) => ({
          name: item.name as string,
          category: (item.category as string) || '',
          brand: (item.brand as string) || 'Unknown',
          genetics: (item.genetics as string) || 'unknown',
          price: bestPriceValue(item),
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
        distance_mi: dispMeta.get(Number(disp.id))?.distance_mi,
        active_deal: dispMeta.get(Number(disp.id))?.active_deal ?? true,
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
      next_actions: nextForDealScout({
        location,
        category: categoryInput || undefined,
        bestProductName: results[0]?.deal_products?.[0]?.name,
      }),
      response_ms: responseMs,
    };

    setCache(cacheKey, responseData);
    return ok(responseData, { endpoint: 'deal-scout', source: 'database', cache: 'miss', responseMs });
  } catch (err) {
    return internalError(err, 'deal-scout');
  }
}

export const POST = withPayment(handler, '0.02', 'cannastack deal-scout: Find the best active cannabis deals in range.');
