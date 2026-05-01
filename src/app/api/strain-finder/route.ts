import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { geocode } from '@/lib/geocode';
import { findNearbyDispensaries, searchStrainInDB } from '@/lib/queries';
import { logRequest } from '@/lib/request-log';

function bestPrice(row: Record<string, unknown>): number {
  if (Number(row.price_unit) > 0) return Number(row.price_unit);
  if (Number(row.price_eighth) > 0) return Number(row.price_eighth);
  if (Number(row.price_gram) > 0) return Number(row.price_gram);
  if (Number(row.price_quarter) > 0) return Number(row.price_quarter);
  if (Number(row.price_half_ounce) > 0) return Number(row.price_half_ounce);
  if (Number(row.price_ounce) > 0) return Number(row.price_ounce);
  return 0;
}

export async function POST(req: NextRequest) {
  const startMs = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const strain = body.strain?.trim();
    const location = body.location?.trim();

    if (!strain) {
      return NextResponse.json({ ok: false, error: "Missing 'strain'" }, { status: 400 });
    }
    if (!location) {
      return NextResponse.json({ ok: false, error: "Missing 'location'" }, { status: 400 });
    }

    const radiusMi = parseInt(body.radius || '15', 10) || 15;

    const geo = await geocode(location);
    if (!geo) {
      return NextResponse.json(
        { ok: false, error: `Could not geocode: ${location}` },
        { status: 400 },
      );
    }

    const sql = getDb();

    // Find nearby dispensaries from DB
    const dispensaries = await findNearbyDispensaries(sql, geo.lat, geo.lng, radiusMi);

    if (dispensaries.length === 0) {
      return NextResponse.json({
        ok: true,
        strain,
        location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
        source: 'database',
        dispensaries_searched: 0,
        results: [],
        summary: `No dispensaries found within ${radiusMi} miles of ${location}. This area may not be crawled yet.`,
        response_ms: Date.now() - startMs,
      });
    }

    const dispIds = dispensaries.map((d) => d.id as number);
    const matches = await searchStrainInDB(sql, strain, dispIds);

    // Group by dispensary
    const dispMap = new Map<
      number,
      {
        dispensary: string;
        rating: number;
        reviews: number;
        type: string;
        address: string;
        city: string;
        url: string;
        matches: Array<{
          name: string;
          category: string;
          brand: string;
          genetics: string;
          price: number;
          orderable: boolean;
        }>;
      }
    >();

    for (const row of matches) {
      const dispId = row.dispensary_id as number;
      if (!dispMap.has(dispId)) {
        dispMap.set(dispId, {
          dispensary: row.dispensary_name as string,
          rating: Number(row.dispensary_rating) || 0,
          reviews: Number(row.dispensary_reviews) || 0,
          type: (row.dispensary_type as string) || '',
          address: (row.dispensary_address as string) || '',
          city: (row.dispensary_city as string) || '',
          url: (row.dispensary_url as string) || '',
          matches: [],
        });
      }
      dispMap.get(dispId)!.matches.push({
        name: row.name as string,
        category: (row.category as string) || '',
        brand: (row.brand as string) || 'Unknown',
        genetics: (row.genetics as string) || 'unknown',
        price: bestPrice(row),
        orderable: row.orderable as boolean,
      });
    }

    const results = Array.from(dispMap.values()).sort((a, b) => {
      const aMin = Math.min(...a.matches.map((m) => m.price || Infinity));
      const bMin = Math.min(...b.matches.map((m) => m.price || Infinity));
      return aMin - bMin;
    });

    const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);
    const cheapest = results[0]?.matches.sort(
      (a, b) => (a.price || Infinity) - (b.price || Infinity),
    )[0];

    let summary = `Searched ${dispensaries.length} dispensaries near ${location} for "${strain}". `;
    if (results.length === 0) {
      summary += 'No matches found in crawled menu data.';
    } else {
      summary += `Found ${totalMatches} match${totalMatches === 1 ? '' : 'es'} at ${results.length} dispensar${results.length === 1 ? 'y' : 'ies'}.`;
      if (cheapest && cheapest.price > 0) {
        summary += ` Cheapest: $${cheapest.price} at ${results[0].dispensary}.`;
      }
    }

    const responseMs = Date.now() - startMs;
    logRequest(sql, 'strain-finder', location, geo.lat, geo.lng, { strain, radius: radiusMi }, totalMatches, responseMs);

    return NextResponse.json({
      ok: true,
      strain,
      location: { query: location, lat: geo.lat, lng: geo.lng, resolved: geo.display_name },
      source: 'database',
      dispensaries_searched: dispensaries.length,
      results,
      summary,
      response_ms: responseMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
