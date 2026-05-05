import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';
import { getCached, setCache } from '@/lib/cache';

interface PricePoint {
  item_name: string;
  brand: string;
  category: string;
  dispensary_name: string;
  price_unit: number | null;
  price_eighth: number | null;
  price_gram: number | null;
  recorded_at: string;
}

function getTrend(prices: number[]): 'up' | 'down' | 'stable' {
  if (prices.length < 2) return 'stable';
  const first = prices[0];
  const last = prices[prices.length - 1];
  const diff = last - first;
  const pct = (diff / first) * 100;
  if (pct > 2) return 'up';
  if (pct < -2) return 'down';
  return 'stable';
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const strain = body.strain?.trim() || null;
    const dispensaryName = body.dispensary?.trim() || null;
    const category = body.category?.trim().toLowerCase() || null;
    const location = body.location?.trim() || null;
    const days = Math.min(Math.max(parseInt(body.days || '30', 10) || 30, 1), 365);

    if (!strain && !dispensaryName) {
      return NextResponse.json(
        { ok: false, error: "Provide either 'strain' or 'dispensary'" },
        { status: 400 },
      );
    }

    // Check cache
    const sortedParams = JSON.stringify({ category, days, dispensary: dispensaryName, location, strain });
    const cacheKey = `price-history:${sortedParams}`;
    const cached = getCached<Record<string, unknown>>(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, cached: true, response_ms: Date.now() - startMs });
    }

    const sql = getDb();
    let dispIds: number[] | null = null;
    let geoLat: number | null = null;
    let geoLng: number | null = null;

    if (location) {
      const geo = await geocode(location);
      if (!geo) {
        return NextResponse.json(
          { ok: false, error: `Could not geocode: ${location}` },
          { status: 400 },
        );
      }
      geoLat = geo.lat;
      geoLng = geo.lng;

      const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, 15);
      if (dispensaries.length === 0) {
        const responseData = {
          ok: true,
          query: { strain, dispensary: dispensaryName, category, days, location },
          source: 'database',
          history: [],
          stats: null,
          summary: `No dispensaries found near ${location}. This area may not be crawled yet.`,
          response_ms: Date.now() - startMs,
        };
        return NextResponse.json(responseData);
      }
      dispIds = dispensaries.map((d) => d.id as number);
    }

    let history: PricePoint[];

    if (strain) {
      if (dispIds) {
        history = (await sql`
          SELECT mi.name as item_name, mi.brand, mi.category, d.name as dispensary_name,
                 ph.price_unit, ph.price_eighth, ph.price_gram, ph.recorded_at
          FROM price_history ph
          JOIN menu_items mi ON mi.id = ph.menu_item_id
          JOIN dispensaries d ON d.id = mi.dispensary_id
          WHERE mi.name ILIKE ${'%' + strain + '%'}
            AND mi.dispensary_id = ANY(${dispIds})
            AND ph.recorded_at > NOW() - INTERVAL '1 day' * ${days}
          ORDER BY ph.recorded_at DESC
          LIMIT 500
        `) as unknown as PricePoint[];
      } else {
        history = (await sql`
          SELECT mi.name as item_name, mi.brand, mi.category, d.name as dispensary_name,
                 ph.price_unit, ph.price_eighth, ph.price_gram, ph.recorded_at
          FROM price_history ph
          JOIN menu_items mi ON mi.id = ph.menu_item_id
          JOIN dispensaries d ON d.id = mi.dispensary_id
          WHERE mi.name ILIKE ${'%' + strain + '%'}
            AND ph.recorded_at > NOW() - INTERVAL '1 day' * ${days}
          ORDER BY ph.recorded_at DESC
          LIMIT 500
        `) as unknown as PricePoint[];
      }
    } else {
      // dispensary + optional category
      if (category) {
        history = (await sql`
          SELECT mi.name as item_name, mi.brand, mi.category, d.name as dispensary_name,
                 ph.price_unit, ph.price_eighth, ph.price_gram, ph.recorded_at
          FROM price_history ph
          JOIN menu_items mi ON mi.id = ph.menu_item_id
          JOIN dispensaries d ON d.id = mi.dispensary_id
          WHERE d.name ILIKE ${'%' + dispensaryName + '%'}
            AND LOWER(mi.category) = ${category}
            AND ph.recorded_at > NOW() - INTERVAL '1 day' * ${days}
          ORDER BY ph.recorded_at DESC
          LIMIT 500
        `) as unknown as PricePoint[];
      } else {
        history = (await sql`
          SELECT mi.name as item_name, mi.brand, mi.category, d.name as dispensary_name,
                 ph.price_unit, ph.price_eighth, ph.price_gram, ph.recorded_at
          FROM price_history ph
          JOIN menu_items mi ON mi.id = ph.menu_item_id
          JOIN dispensaries d ON d.id = mi.dispensary_id
          WHERE d.name ILIKE ${'%' + dispensaryName + '%'}
            AND ph.recorded_at > NOW() - INTERVAL '1 day' * ${days}
          ORDER BY ph.recorded_at DESC
          LIMIT 500
        `) as unknown as PricePoint[];
      }
    }

    // Compute stats
    const prices = history
      .map((h) => Number(h.price_unit) || Number(h.price_eighth) || Number(h.price_gram) || 0)
      .filter((p) => p > 0);

    const stats =
      prices.length > 0
        ? {
            current: prices[0],
            oldest: prices[prices.length - 1],
            change_pct:
              Math.round(
                ((prices[0] - prices[prices.length - 1]) / prices[prices.length - 1]) * 10000,
              ) / 100,
            trend: getTrend(prices.reverse()),
            data_points: history.length,
          }
        : null;

    let summary = '';
    if (history.length === 0) {
      summary = `No price changes recorded in the last ${days} days`;
      if (strain) summary += ` for "${strain}"`;
      if (dispensaryName) summary += ` at "${dispensaryName}"`;
      summary += '.';
    } else {
      summary = `${history.length} price change${history.length === 1 ? '' : 's'} in the last ${days} days.`;
      if (stats) {
        summary += ` Current: $${stats.current}. Trend: ${stats.trend} (${stats.change_pct > 0 ? '+' : ''}${stats.change_pct}%).`;
      }
    }

    const responseMs = Date.now() - startMs;
    logRequest(
      sql,
      'price-history',
      location,
      geoLat,
      geoLng,
      { strain, dispensary: dispensaryName, category, days },
      history.length,
      responseMs,
    );

    const responseData = {
      ok: true,
      query: { strain, dispensary: dispensaryName, category, days, location },
      source: 'database',
      history,
      stats,
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
