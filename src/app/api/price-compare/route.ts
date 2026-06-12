import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchCategoryInDB } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';
import { getCached, setCache } from '@/lib/cache';
import { fallbackSearchCategory } from '@/lib/fallback';
import { ok, preflight, badRequest, internalError } from '@/lib/api-response';
import { CATEGORY_MAP, CATEGORY_OPTIONS } from '@/lib/categories';
import { bestPrice } from '@/lib/pricing';
import { clampInt, MAX_RADIUS_MI, MAX_RESULT_LIMIT } from '@/lib/validate';
import { withPayment } from '@/lib/x402';

export const OPTIONS = preflight;

async function handler(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const categoryInput = body.category?.trim().toLowerCase();
    const location = body.location?.trim();

    if (!categoryInput) {
      return badRequest(
        `Missing required parameter 'category'. Options: ${CATEGORY_OPTIONS}`,
        'price-compare',
      );
    }
    if (!location) {
      return badRequest("Missing required parameter 'location'", 'price-compare');
    }

    const targetCategories = CATEGORY_MAP[categoryInput];
    if (!targetCategories) {
      return badRequest(
        `Unknown category: "${categoryInput}". Options: ${CATEGORY_OPTIONS}`,
        'price-compare',
      );
    }

    const radiusMi = clampInt(body.radius, 15, 1, MAX_RADIUS_MI);
    const genetics = body.genetics?.trim().toLowerCase() || null;
    const limit = clampInt(body.limit, 50, 1, MAX_RESULT_LIMIT);

    // Check cache
    const sortedParams = JSON.stringify({
      category: categoryInput,
      genetics,
      limit,
      location,
      radius: radiusMi,
    });
    const cacheKey = `price-compare:${sortedParams}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      const responseMs = Date.now() - startMs;
      return ok(
        { ...cached, cached: true, response_ms: responseMs },
        { endpoint: 'price-compare', cache: 'hit', source: 'cache', responseMs },
      );
    }

    const geo = await geocode(location);
    if (!geo) {
      return badRequest(`Could not geocode location: "${location}". Use a US city, address, or "City, ST".`, 'price-compare');
    }

    const sql = getDb();
    const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, radiusMi);

    let source: 'database' | 'live' = 'database';
    let items: Record<string, unknown>[];
    let dispCount = dispensaries.length;

    if (dispensaries.length === 0) {
      source = 'live';
      const fallback = await fallbackSearchCategory(
        geo.lat,
        geo.lng,
        targetCategories,
        genetics,
        radiusMi,
        limit,
      );
      dispCount = fallback.dispensaries.length;
      items = fallback.items as unknown as Record<string, unknown>[];
    } else {
      const dispIds = dispensaries.map((d) => d.id as number);
      items = (await searchCategoryInDB(
        sql,
        targetCategories,
        dispIds,
        genetics,
        limit,
      )) as unknown as Record<string, unknown>[];
    }

    const results = items.map((row) => {
      const { price, unit } = bestPrice(row);
      return {
        name: row.name as string,
        brand: (row.brand as string) || 'Unknown',
        genetics: (row.genetics as string) || 'unknown',
        price,
        unit,
        dispensary: row.dispensary_name as string,
        dispensary_rating: Number(row.dispensary_rating) || 0,
        dispensary_url: (row.dispensary_url as string) || '',
        orderable: row.orderable as boolean,
      };
    });

    const prices = results.map((r) => r.price).filter((p) => p > 0);
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;
    const avg =
      prices.length > 0
        ? Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100
        : 0;

    let summary = `Compared ${results.length} ${categoryInput}${genetics ? ` (${genetics})` : ''} products across ${dispCount} dispensaries near ${location}.`;
    if (results.length === 0) {
      summary += ' No matching products found.';
    } else {
      summary += ` Cheapest: $${min}${results[0] ? ` (${results[0].name} at ${results[0].dispensary})` : ''}. Most expensive: $${max}. Average: $${avg}.`;
    }
    if (source === 'live') {
      summary += ' (live data)';
    }

    const responseMs = Date.now() - startMs;
    logRequest(
      sql,
      'price-compare',
      location,
      geo.lat,
      geo.lng,
      { category: categoryInput, genetics, limit, source },
      results.length,
      responseMs,
    );

    const responseData = {
      ok: true,
      category: categoryInput,
      genetics: genetics || 'all',
      location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
      source,
      dispensaries_searched: dispCount,
      total_matches: results.length,
      results,
      stats: { min, max, avg, count: results.length },
      summary,
      response_ms: responseMs,
    };

    setCache(cacheKey, responseData);
    return ok(responseData, { endpoint: 'price-compare', source, cache: 'miss', responseMs });
  } catch (err) {
    return internalError(err, 'price-compare');
  }
}

export const POST = withPayment(handler, '0.02', 'cannastack price-compare: Compare category prices across every dispensary in range.');
