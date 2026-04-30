import type { NeonQueryFunction } from '@neondatabase/serverless';
import type { DataSourceAdapter, Metro, CrawlResult, RawMenuItem } from './types';

const CONCURRENCY = 2;
const DELAY_MS = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function upsertDispensary(
  sql: NeonQueryFunction<false, false>,
  disp: {
    source: string;
    sourceId: string;
    name: string;
    slug?: string;
    address?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
    type?: string;
    rating?: number;
    reviewsCount?: number;
    hasDeals?: boolean;
    webUrl?: string;
  },
): Promise<number> {
  const result = await sql`
    INSERT INTO dispensaries (source, source_id, name, slug, address, city, state, lat, lng, type, rating, reviews_count, has_deals, web_url, last_crawled_at, updated_at)
    VALUES (${disp.source}, ${disp.sourceId}, ${disp.name}, ${disp.slug ?? null}, ${disp.address ?? null}, ${disp.city ?? null}, ${disp.state ?? null}, ${disp.lat ?? null}, ${disp.lng ?? null}, ${disp.type ?? null}, ${disp.rating ?? null}, ${disp.reviewsCount ?? null}, ${disp.hasDeals ?? false}, ${disp.webUrl ?? null}, NOW(), NOW())
    ON CONFLICT (source, source_id)
    DO UPDATE SET
      name = EXCLUDED.name,
      slug = EXCLUDED.slug,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      lat = EXCLUDED.lat,
      lng = EXCLUDED.lng,
      type = EXCLUDED.type,
      rating = EXCLUDED.rating,
      reviews_count = EXCLUDED.reviews_count,
      has_deals = EXCLUDED.has_deals,
      web_url = EXCLUDED.web_url,
      last_crawled_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `;
  return result[0].id as number;
}

async function upsertMenuItem(
  sql: NeonQueryFunction<false, false>,
  dispensaryId: number,
  source: string,
  item: RawMenuItem,
): Promise<{ isNew: boolean; priceChanged: boolean; menuItemId: number }> {
  const existing = await sql`
    SELECT id, price_unit, price_eighth, price_gram
    FROM menu_items
    WHERE dispensary_id = ${dispensaryId}
      AND source = ${source}
      AND name = ${item.name}
      AND brand = ${item.brand ?? null}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const old = existing[0];
    const priceChanged =
      Number(old.price_unit) !== (item.priceUnit ?? 0) ||
      Number(old.price_eighth) !== (item.priceEighth ?? 0) ||
      Number(old.price_gram) !== (item.priceGram ?? 0);

    await sql`
      UPDATE menu_items SET
        category = ${item.category ?? null},
        genetics = ${item.genetics ?? null},
        description = ${item.description ?? null},
        thc_pct = ${item.thcPct ?? null},
        cbd_pct = ${item.cbdPct ?? null},
        price_unit = ${item.priceUnit ?? null},
        price_half_gram = ${item.priceHalfGram ?? null},
        price_gram = ${item.priceGram ?? null},
        price_eighth = ${item.priceEighth ?? null},
        price_quarter = ${item.priceQuarter ?? null},
        price_half_ounce = ${item.priceHalfOunce ?? null},
        price_ounce = ${item.priceOunce ?? null},
        orderable = ${item.orderable ?? false},
        crawled_at = NOW()
      WHERE id = ${old.id}
    `;

    if (priceChanged) {
      await sql`
        INSERT INTO price_history (menu_item_id, price_unit, price_eighth, price_gram)
        VALUES (${old.id}, ${item.priceUnit ?? null}, ${item.priceEighth ?? null}, ${item.priceGram ?? null})
      `;
    }

    return { isNew: false, priceChanged, menuItemId: old.id as number };
  }

  const inserted = await sql`
    INSERT INTO menu_items (dispensary_id, source, source_item_id, name, category, brand, genetics, description, thc_pct, cbd_pct, price_unit, price_half_gram, price_gram, price_eighth, price_quarter, price_half_ounce, price_ounce, orderable)
    VALUES (${dispensaryId}, ${source}, ${item.sourceItemId ?? null}, ${item.name}, ${item.category ?? null}, ${item.brand ?? null}, ${item.genetics ?? null}, ${item.description ?? null}, ${item.thcPct ?? null}, ${item.cbdPct ?? null}, ${item.priceUnit ?? null}, ${item.priceHalfGram ?? null}, ${item.priceGram ?? null}, ${item.priceEighth ?? null}, ${item.priceQuarter ?? null}, ${item.priceHalfOunce ?? null}, ${item.priceOunce ?? null}, ${item.orderable ?? false})
    ON CONFLICT (dispensary_id, source, name, brand)
    DO UPDATE SET crawled_at = NOW()
    RETURNING id
  `;

  return { isNew: true, priceChanged: false, menuItemId: inserted[0].id as number };
}

export async function crawlMetro(
  sql: NeonQueryFunction<false, false>,
  metro: Metro,
  adapter: DataSourceAdapter,
): Promise<CrawlResult> {
  const startTime = Date.now();
  let itemsCrawled = 0;
  let itemsNew = 0;
  let itemsUpdated = 0;
  let errors = 0;

  console.log(`Crawling ${metro.name} via ${adapter.name}...`);

  const dispensaries = await adapter.findDispensaries(metro.lat, metro.lng, metro.radius_mi);
  console.log(`  Found ${dispensaries.length} dispensaries`);

  // Process dispensaries in batches
  for (let i = 0; i < dispensaries.length; i += CONCURRENCY) {
    const batch = dispensaries.slice(i, i + CONCURRENCY);

    await Promise.all(
      batch.map(async (disp) => {
        try {
          const dispensaryId = await upsertDispensary(sql, disp);
          const menuItems = await adapter.fetchMenu(disp.sourceId);

          for (const item of menuItems) {
            try {
              const result = await upsertMenuItem(sql, dispensaryId, adapter.name, item);
              itemsCrawled++;
              if (result.isNew) itemsNew++;
              if (result.priceChanged) itemsUpdated++;
            } catch (err) {
              errors++;
              console.error(`  Error upserting item "${item.name}" at ${disp.name}:`, err);
            }
          }
        } catch (err) {
          errors++;
          console.error(`  Error processing dispensary ${disp.name}:`, err);
        }
      }),
    );

    if (i + CONCURRENCY < dispensaries.length) {
      await sleep(DELAY_MS);
    }
  }

  const durationMs = Date.now() - startTime;

  // Log the crawl
  await sql`
    INSERT INTO crawl_log (metro_id, source, dispensaries_found, items_crawled, items_new, items_updated, errors, duration_ms, completed_at)
    VALUES (${metro.id}, ${adapter.name}, ${dispensaries.length}, ${itemsCrawled}, ${itemsNew}, ${itemsUpdated}, ${errors}, ${durationMs}, NOW())
  `;

  console.log(
    `  Done: ${itemsCrawled} items (${itemsNew} new, ${itemsUpdated} price changes, ${errors} errors) in ${durationMs}ms`,
  );

  return {
    metroId: metro.id,
    source: adapter.name,
    dispensariesFound: dispensaries.length,
    itemsCrawled,
    itemsNew,
    itemsUpdated,
    errors,
    durationMs,
  };
}
