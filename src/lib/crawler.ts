import type { NeonQueryFunction } from '@neondatabase/serverless';
import type {
  CrawlResult,
  CrawlRunStage,
  CrawlWarning,
  DataSourceAdapter,
  ExtractedDispensary,
  Metro,
  RawDispensary,
  RawMenuItem,
} from './types';

const CONCURRENCY = 2;
const DELAY_MS = 500;

type Sql = NeonQueryFunction<false, false>;

type LoadAction = 'created' | 'updated' | 'skipped';

interface TransformedMenuItem {
  sourceItemKey: string;
  sourceItemId: string | null;
  contentHash: string;
  raw: RawMenuItem;
}

interface TransformedDispensary {
  dispensary: RawDispensary;
  menuItems: TransformedMenuItem[];
}

interface LoadStats {
  itemsLoaded: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsSkipped: number;
  itemsStale: number;
  errors: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function stableItemKey(item: RawMenuItem): string {
  if (item.sourceItemId?.trim()) return item.sourceItemId.trim();
  return `${normalizeText(item.name)}::${normalizeText(item.brand)}`;
}

function stableItemPayload(item: RawMenuItem): Record<string, unknown> {
  return {
    brand: item.brand ?? null,
    category: item.category ?? null,
    cbdPct: item.cbdPct ?? null,
    description: item.description ?? null,
    genetics: item.genetics ?? null,
    name: item.name,
    orderable: item.orderable ?? false,
    priceEighth: item.priceEighth ?? null,
    priceGram: item.priceGram ?? null,
    priceHalfGram: item.priceHalfGram ?? null,
    priceHalfOunce: item.priceHalfOunce ?? null,
    priceOunce: item.priceOunce ?? null,
    priceQuarter: item.priceQuarter ?? null,
    priceUnit: item.priceUnit ?? null,
    sourceItemId: item.sourceItemId ?? null,
    thcPct: item.thcPct ?? null,
  };
}

function contentHash(payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload);
  let hash = 5381;

  for (let i = 0; i < json.length; i += 1) {
    hash = (hash * 33) ^ json.charCodeAt(i);
  }

  return (hash >>> 0).toString(16);
}

function pricesChanged(row: Record<string, unknown>, item: RawMenuItem): boolean {
  return (
    Number(row.price_unit ?? 0) !== (item.priceUnit ?? 0) ||
    Number(row.price_eighth ?? 0) !== (item.priceEighth ?? 0) ||
    Number(row.price_gram ?? 0) !== (item.priceGram ?? 0)
  );
}

async function updateRunStage(sql: Sql, runId: number, stage: CrawlRunStage) {
  await sql`
    UPDATE crawl_runs
    SET stage = ${stage}
    WHERE id = ${runId}
  `;
}

async function createCrawlRun(sql: Sql, metro: Metro, source: string): Promise<number> {
  const result = await sql`
    INSERT INTO crawl_runs (metro_id, source, status, stage)
    VALUES (${metro.id}, ${source}, 'running', 'setup')
    RETURNING id
  `;

  return result[0].id as number;
}

async function recordWarning(sql: Sql, runId: number, warning: CrawlWarning) {
  await sql`
    INSERT INTO crawl_warnings (crawl_run_id, stage, source_id, item_name, message)
    VALUES (
      ${runId},
      ${warning.stage},
      ${warning.sourceId ?? null},
      ${warning.itemName ?? null},
      ${warning.message}
    )
  `;
}

async function recordItemEvent(
  sql: Sql,
  input: {
    runId: number;
    source: string;
    sourceDispensaryId?: string;
    sourceItemKey?: string;
    menuItemId?: number;
    status: string;
    errorMessage?: string;
    rawPayload?: RawMenuItem;
    transformedPayload?: Record<string, unknown>;
    contentHash?: string;
  },
) {
  await sql`
    INSERT INTO crawl_item_events (
      crawl_run_id,
      source,
      source_dispensary_id,
      source_item_key,
      menu_item_id,
      status,
      error_message,
      raw_payload,
      transformed_payload,
      content_hash
    )
    VALUES (
      ${input.runId},
      ${input.source},
      ${input.sourceDispensaryId ?? null},
      ${input.sourceItemKey ?? null},
      ${input.menuItemId ?? null},
      ${input.status},
      ${input.errorMessage ?? null},
      ${input.rawPayload ? JSON.stringify(input.rawPayload) : null},
      ${input.transformedPayload ? JSON.stringify(input.transformedPayload) : null},
      ${input.contentHash ?? null}
    )
  `;
}

async function upsertDispensary(sql: Sql, disp: RawDispensary): Promise<number> {
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
  sql: Sql,
  runId: number,
  dispensaryId: number,
  source: string,
  item: TransformedMenuItem,
): Promise<{ action: LoadAction; menuItemId: number }> {
  const existing = await sql`
    SELECT id, source_content_hash, price_unit, price_eighth, price_gram
    FROM menu_items
    WHERE dispensary_id = ${dispensaryId}
      AND source = ${source}
      AND source_item_key = ${item.sourceItemKey}
    LIMIT 1
  `;

  if (existing.length > 0) {
    const old = existing[0];
    const priceChanged = pricesChanged(old, item.raw);
    const payloadChanged = old.source_content_hash !== item.contentHash;
    const action: LoadAction = priceChanged || payloadChanged ? 'updated' : 'skipped';

    await sql`
      UPDATE menu_items SET
        source_item_id = ${item.sourceItemId},
        name = ${item.raw.name},
        category = ${item.raw.category ?? null},
        brand = ${item.raw.brand ?? null},
        genetics = ${item.raw.genetics ?? null},
        description = ${item.raw.description ?? null},
        thc_pct = ${item.raw.thcPct ?? null},
        cbd_pct = ${item.raw.cbdPct ?? null},
        price_unit = ${item.raw.priceUnit ?? null},
        price_half_gram = ${item.raw.priceHalfGram ?? null},
        price_gram = ${item.raw.priceGram ?? null},
        price_eighth = ${item.raw.priceEighth ?? null},
        price_quarter = ${item.raw.priceQuarter ?? null},
        price_half_ounce = ${item.raw.priceHalfOunce ?? null},
        price_ounce = ${item.raw.priceOunce ?? null},
        available = true,
        orderable = ${item.raw.orderable ?? false},
        source_content_hash = ${item.contentHash},
        last_seen_run_id = ${runId},
        raw_payload = ${JSON.stringify(item.raw)},
        crawled_at = NOW(),
        updated_at = NOW()
      WHERE id = ${old.id}
    `;

    if (priceChanged) {
      await sql`
        INSERT INTO price_history (menu_item_id, price_unit, price_eighth, price_gram)
        VALUES (${old.id}, ${item.raw.priceUnit ?? null}, ${item.raw.priceEighth ?? null}, ${item.raw.priceGram ?? null})
      `;
    }

    return { action, menuItemId: old.id as number };
  }

  const inserted = await sql`
    INSERT INTO menu_items (
      dispensary_id,
      source,
      source_item_id,
      source_item_key,
      name,
      category,
      brand,
      genetics,
      description,
      thc_pct,
      cbd_pct,
      price_unit,
      price_half_gram,
      price_gram,
      price_eighth,
      price_quarter,
      price_half_ounce,
      price_ounce,
      available,
      orderable,
      source_content_hash,
      last_seen_run_id,
      raw_payload,
      updated_at
    )
    VALUES (
      ${dispensaryId},
      ${source},
      ${item.sourceItemId},
      ${item.sourceItemKey},
      ${item.raw.name},
      ${item.raw.category ?? null},
      ${item.raw.brand ?? null},
      ${item.raw.genetics ?? null},
      ${item.raw.description ?? null},
      ${item.raw.thcPct ?? null},
      ${item.raw.cbdPct ?? null},
      ${item.raw.priceUnit ?? null},
      ${item.raw.priceHalfGram ?? null},
      ${item.raw.priceGram ?? null},
      ${item.raw.priceEighth ?? null},
      ${item.raw.priceQuarter ?? null},
      ${item.raw.priceHalfOunce ?? null},
      ${item.raw.priceOunce ?? null},
      true,
      ${item.raw.orderable ?? false},
      ${item.contentHash},
      ${runId},
      ${JSON.stringify(item.raw)},
      NOW()
    )
    ON CONFLICT (dispensary_id, source, source_item_key)
    DO UPDATE SET
      available = true,
      orderable = EXCLUDED.orderable,
      source_content_hash = EXCLUDED.source_content_hash,
      last_seen_run_id = EXCLUDED.last_seen_run_id,
      raw_payload = EXCLUDED.raw_payload,
      crawled_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `;

  return { action: 'created', menuItemId: inserted[0].id as number };
}

async function extractStage(
  sql: Sql,
  runId: number,
  metro: Metro,
  adapter: DataSourceAdapter,
): Promise<{ dispensaries: ExtractedDispensary[]; warnings: CrawlWarning[] }> {
  await updateRunStage(sql, runId, 'extract');

  const dispensaries = await adapter.findDispensaries(metro.lat, metro.lng, metro.radius_mi);
  const extracted: ExtractedDispensary[] = [];
  const warnings: CrawlWarning[] = [];

  for (let i = 0; i < dispensaries.length; i += CONCURRENCY) {
    const batch = dispensaries.slice(i, i + CONCURRENCY);

    const batchResults = await Promise.all(
      batch.map(async (disp) => {
        try {
          const menuItems = await adapter.fetchMenu(disp.sourceId);
          return { dispensary: disp, menuItems };
        } catch (err) {
          warnings.push({
            stage: 'extract',
            sourceId: disp.sourceId,
            message: `Failed to fetch menu for ${disp.name}: ${errorMessage(err)}`,
          });

          return { dispensary: disp, menuItems: [] };
        }
      }),
    );

    extracted.push(...batchResults);

    if (i + CONCURRENCY < dispensaries.length) {
      await sleep(DELAY_MS);
    }
  }

  await sql`
    UPDATE crawl_runs
    SET dispensaries_found = ${dispensaries.length},
        items_extracted = ${extracted.reduce((sum, disp) => sum + disp.menuItems.length, 0)}
    WHERE id = ${runId}
  `;

  return { dispensaries: extracted, warnings };
}

async function transformStage(
  sql: Sql,
  runId: number,
  source: string,
  extracted: ExtractedDispensary[],
): Promise<{ dispensaries: TransformedDispensary[]; warnings: CrawlWarning[]; failedCount: number }> {
  await updateRunStage(sql, runId, 'transform');

  const warnings: CrawlWarning[] = [];
  const dispensaries: TransformedDispensary[] = [];
  let failedCount = 0;

  for (const extractedDispensary of extracted) {
    const transformed: TransformedMenuItem[] = [];

    for (const item of extractedDispensary.menuItems) {
      const name = item.name?.trim();

      if (!name) {
        const message = 'Menu item missing name';
        warnings.push({
          stage: 'transform',
          sourceId: extractedDispensary.dispensary.sourceId,
          message,
        });
        failedCount++;

        await recordItemEvent(sql, {
          runId,
          source,
          sourceDispensaryId: extractedDispensary.dispensary.sourceId,
          status: 'failed',
          errorMessage: message,
          rawPayload: item,
        });
        continue;
      }

      const normalizedItem = { ...item, name };
      const sourceItemKey = stableItemKey(normalizedItem);
      const payload = stableItemPayload(normalizedItem);

      transformed.push({
        sourceItemKey,
        sourceItemId: normalizedItem.sourceItemId?.trim() || null,
        contentHash: contentHash(payload),
        raw: normalizedItem,
      });
    }

    dispensaries.push({
      dispensary: extractedDispensary.dispensary,
      menuItems: transformed,
    });
  }

  return { dispensaries, warnings, failedCount };
}

async function loadStage(
  sql: Sql,
  runId: number,
  source: string,
  transformed: TransformedDispensary[],
): Promise<LoadStats & { processedDispensaryIds: number[] }> {
  await updateRunStage(sql, runId, 'load');

  const processedDispensaryIds: number[] = [];
  const stats: LoadStats = {
    itemsLoaded: 0,
    itemsNew: 0,
    itemsUpdated: 0,
    itemsSkipped: 0,
    itemsStale: 0,
    errors: 0,
  };

  for (const itemGroup of transformed) {
    try {
      const dispensaryId = await upsertDispensary(sql, itemGroup.dispensary);
      processedDispensaryIds.push(dispensaryId);

      for (const item of itemGroup.menuItems) {
        try {
          const result = await upsertMenuItem(sql, runId, dispensaryId, source, item);
          stats.itemsLoaded++;

          if (result.action === 'created') stats.itemsNew++;
          if (result.action === 'updated') stats.itemsUpdated++;
          if (result.action === 'skipped') stats.itemsSkipped++;

          await recordItemEvent(sql, {
            runId,
            source,
            sourceDispensaryId: itemGroup.dispensary.sourceId,
            sourceItemKey: item.sourceItemKey,
            menuItemId: result.menuItemId,
            status: result.action,
            rawPayload: item.raw,
            transformedPayload: stableItemPayload(item.raw),
            contentHash: item.contentHash,
          });
        } catch (err) {
          stats.errors++;
          await recordItemEvent(sql, {
            runId,
            source,
            sourceDispensaryId: itemGroup.dispensary.sourceId,
            sourceItemKey: item.sourceItemKey,
            status: 'failed',
            errorMessage: errorMessage(err),
            rawPayload: item.raw,
            transformedPayload: stableItemPayload(item.raw),
            contentHash: item.contentHash,
          });
        }
      }
    } catch (err) {
      stats.errors++;
      await recordWarning(sql, runId, {
        stage: 'load',
        sourceId: itemGroup.dispensary.sourceId,
        message: `Failed to load dispensary ${itemGroup.dispensary.name}: ${errorMessage(err)}`,
      });
    }
  }

  return { ...stats, processedDispensaryIds };
}

async function cleanupStage(
  sql: Sql,
  runId: number,
  source: string,
  processedDispensaryIds: number[],
): Promise<number> {
  await updateRunStage(sql, runId, 'cleanup');

  if (processedDispensaryIds.length === 0) return 0;

  const stale = await sql`
    UPDATE menu_items
    SET available = false,
        orderable = false,
        updated_at = NOW()
    WHERE source = ${source}
      AND dispensary_id = ANY(${processedDispensaryIds})
      AND (last_seen_run_id IS NULL OR last_seen_run_id <> ${runId})
      AND available = true
    RETURNING id
  `;

  return stale.length;
}

async function finalizeRun(
  sql: Sql,
  runId: number,
  metro: Metro,
  source: string,
  result: CrawlResult,
) {
  await sql`
    UPDATE crawl_runs
    SET status = 'success',
        stage = 'cleanup',
        items_loaded = ${result.itemsCrawled},
        items_new = ${result.itemsNew},
        items_updated = ${result.itemsUpdated},
        items_skipped = ${result.itemsSkipped ?? 0},
        items_stale = ${result.itemsStale ?? 0},
        warnings_count = ${result.warningCount ?? 0},
        errors_count = ${result.errors},
        completed_at = NOW()
    WHERE id = ${runId}
  `;

  await sql`
    INSERT INTO crawl_log (metro_id, source, dispensaries_found, items_crawled, items_new, items_updated, errors, duration_ms, completed_at)
    VALUES (${metro.id}, ${source}, ${result.dispensariesFound}, ${result.itemsCrawled}, ${result.itemsNew}, ${result.itemsUpdated}, ${result.errors}, ${result.durationMs}, NOW())
  `;
}

async function failRun(sql: Sql, runId: number, stage: CrawlRunStage, err: unknown) {
  await sql`
    UPDATE crawl_runs
    SET status = 'failed',
        stage = ${stage},
        errors_count = errors_count + 1,
        error_message = ${errorMessage(err)},
        completed_at = NOW()
    WHERE id = ${runId}
  `;
}

export async function crawlMetro(
  sql: Sql,
  metro: Metro,
  adapter: DataSourceAdapter,
): Promise<CrawlResult> {
  const startTime = Date.now();
  const runId = await createCrawlRun(sql, metro, adapter.name);
  let currentStage: CrawlRunStage = 'setup';

  console.log(`Crawling ${metro.name} via ${adapter.name} with run ${runId}...`);

  try {
    currentStage = 'extract';
    const extracted = await extractStage(sql, runId, metro, adapter);
    for (const warning of extracted.warnings) {
      await recordWarning(sql, runId, warning);
    }

    currentStage = 'transform';
    const transformed = await transformStage(sql, runId, adapter.name, extracted.dispensaries);
    for (const warning of transformed.warnings) {
      await recordWarning(sql, runId, warning);
    }

    currentStage = 'load';
    const loaded = await loadStage(sql, runId, adapter.name, transformed.dispensaries);

    currentStage = 'cleanup';
    const staleCount = await cleanupStage(
      sql,
      runId,
      adapter.name,
      loaded.processedDispensaryIds,
    );

    const warningCount = extracted.warnings.length + transformed.warnings.length;
    const durationMs = Date.now() - startTime;
    const result: CrawlResult = {
      runId,
      metroId: metro.id,
      source: adapter.name,
      status: 'success',
      dispensariesFound: extracted.dispensaries.length,
      itemsCrawled: loaded.itemsLoaded,
      itemsNew: loaded.itemsNew,
      itemsUpdated: loaded.itemsUpdated,
      itemsSkipped: loaded.itemsSkipped,
      itemsStale: staleCount,
      errors: loaded.errors + transformed.failedCount,
      warningCount,
      durationMs,
    };

    await finalizeRun(sql, runId, metro, adapter.name, result);

    console.log(
      `  Done: ${result.itemsCrawled} items (${result.itemsNew} new, ${result.itemsUpdated} updated, ${result.itemsSkipped ?? 0} skipped, ${staleCount} stale, ${result.errors} errors) in ${durationMs}ms`,
    );

    return result;
  } catch (err) {
    await failRun(sql, runId, currentStage, err);
    throw err;
  }
}
