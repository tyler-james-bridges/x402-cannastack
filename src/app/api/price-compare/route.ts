import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchCategoryInDB } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';
import { getCached, setCache } from '@/lib/cache';
import { fallbackSearchCategory } from '@/lib/fallback';
import { ok, preflight, badRequest, serverError } from '@/lib/api-response';

export const OPTIONS = preflight;

const CATEGORY_MAP: Record<string, string[]> = {
  flower: ['flower'],
  edibles: ['edibles'],
  edible: ['edibles'],
  vape: ['vape pens'],
  vapes: ['vape pens'],
  'vape pens': ['vape pens'],
  cartridge: ['vape pens'],
  concentrate: ['concentrates'],
  concentrates: ['concentrates'],
  dab: ['concentrates'],
  'pre-roll': ['pre-rolls', 'pre roll', 'infused pre roll'],
  'pre-rolls': ['pre-rolls', 'pre roll', 'infused pre roll'],
  preroll: ['pre-rolls', 'pre roll', 'infused pre roll'],
  prerolls: ['pre-rolls', 'pre roll', 'infused pre roll'],
  joint: ['pre-rolls', 'pre roll', 'infused pre roll'],
  drink: ['drinks'],
  drinks: ['drinks'],
  beverage: ['drinks'],
  tincture: ['tinctures'],
  tinctures: ['tinctures'],
  topical: ['topicals'],
  topicals: ['topicals'],
  wellness: ['wellness'],
};

function bestPrice(row: Record<string, unknown>): { price: number; unit: string } {
  if (Number(row.price_unit) > 0) return { price: Number(row.price_unit), unit: 'unit' };
  if (Number(row.price_eighth) > 0) return { price: Number(row.price_eighth), unit: 'eighth' };
  if (Number(row.price_gram) > 0) return { price: Number(row.price_gram), unit: 'gram' };
  if (Number(row.price_quarter) > 0) return { price: Number(row.price_quarter), unit: 'quarter' };
  if (Number(row.price_half_ounce) > 0)
    return { price: Number(row.price_half_ounce), unit: 'half_ounce' };
  if (Number(row.price_ounce) > 0) return { price: Number(row.price_ounce), unit: 'ounce' };
  return { price: 0, unit: 'unknown' };
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const categoryInput = body.category?.trim().toLowerCase();
    const location = body.location?.trim();

    if (!categoryInput) {
      return badRequest(
        "Missing required parameter 'category'. Options: flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness",
        'price-compare',
      );
    }
    if (!location) {
      return badRequest("Missing required parameter 'location'", 'price-compare');
    }

    const targetCategories = CATEGORY_MAP[categoryInput];
    if (!targetCategories) {
      return badRequest(
        `Unknown category: "${categoryInput}". Options: flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness`,
        'price-compare',
      );
    }

    const radiusMi = parseInt(body.radius || '15', 10) || 15;
    const genetics = body.genetics?.trim().toLowerCase() || null;
    const limit = Math.min(body.limit ?? 50, 100);

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
    const message = err instanceof Error ? err.message : 'Request failed';
    return serverError(message, 'price-compare');
  }
}
