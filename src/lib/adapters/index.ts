import type { DataSourceAdapter } from '../types';
import { WeedmapsAdapter } from './weedmaps';
import { LeaflyAdapter } from './leafly';

/**
 * Sources the crawl pipeline enqueues and executes. The registry maps the
 * source name stored on crawl_runs rows to the adapter that executes it.
 *
 * Leafly is implemented but stays OFF by default: their public API access is
 * unconfirmed (probes pending — see docs/verification). Set
 * CRAWL_ENABLE_LEAFLY=1 to start enqueueing leafly runs once access is
 * verified; the adapter degrades to empty results on 4xx/5xx, so a bad flip
 * wastes crawl runs but cannot corrupt data.
 */
export function getAdapterRegistry(): Record<string, DataSourceAdapter> {
  const weedmaps = new WeedmapsAdapter();
  const registry: Record<string, DataSourceAdapter> = {
    [weedmaps.name]: weedmaps,
  };

  if (process.env.CRAWL_ENABLE_LEAFLY === '1' || process.env.CRAWL_ENABLE_LEAFLY === 'true') {
    const leafly = new LeaflyAdapter();
    registry[leafly.name] = leafly;
  }

  return registry;
}

export function enabledSources(): string[] {
  return Object.keys(getAdapterRegistry());
}
