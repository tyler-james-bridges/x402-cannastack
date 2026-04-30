import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchCategoryInDB } from '@/lib/queries';

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
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing 'category'. Options: flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness",
        },
        { status: 400 },
      );
    }
    if (!location) {
      return NextResponse.json({ ok: false, error: "Missing 'location'" }, { status: 400 });
    }

    const targetCategories = CATEGORY_MAP[categoryInput];
    if (!targetCategories) {
      return NextResponse.json(
        {
          ok: false,
          error: `Unknown category: ${categoryInput}. Options: flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness`,
        },
        { status: 400 },
      );
    }

    const radiusMi = parseInt(body.radius || '15', 10) || 15;
    const genetics = body.genetics?.trim().toLowerCase() || null;
    const limit = Math.min(body.limit ?? 50, 100);

    const geo = await geocode(location);
    if (!geo) {
      return NextResponse.json(
        { ok: false, error: `Could not geocode: ${location}` },
        { status: 400 },
      );
    }

    const sql = getDb();
    const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, radiusMi);

    if (dispensaries.length === 0) {
      return NextResponse.json({
        ok: true,
        category: categoryInput,
        location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
        source: 'database',
        dispensaries_searched: 0,
        total_matches: 0,
        results: [],
        stats: { min: 0, max: 0, avg: 0, count: 0 },
        summary: `No dispensaries found within ${radiusMi} miles of ${location}. This area may not be crawled yet.`,
        response_ms: Date.now() - startMs,
      });
    }

    const dispIds = dispensaries.map((d) => d.id as number);
    const items = await searchCategoryInDB(sql, targetCategories, dispIds, genetics, limit);

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

    let summary = `Compared ${results.length} ${categoryInput}${genetics ? ` (${genetics})` : ''} products across ${dispensaries.length} dispensaries near ${location}.`;
    if (results.length === 0) {
      summary += ' No matching products found in crawled data.';
    } else {
      summary += ` Cheapest: $${min}${results[0] ? ` (${results[0].name} at ${results[0].dispensary})` : ''}. Most expensive: $${max}. Average: $${avg}.`;
    }

    return NextResponse.json({
      ok: true,
      category: categoryInput,
      genetics: genetics || 'all',
      location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
      source: 'database',
      dispensaries_searched: dispensaries.length,
      total_matches: results.length,
      results,
      stats: { min, max, avg, count: results.length },
      summary,
      response_ms: Date.now() - startMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
