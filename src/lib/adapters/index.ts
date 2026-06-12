import type { DataSourceAdapter } from '../types';
import { WeedmapsAdapter } from './weedmaps';

/**
 * Sources the crawl pipeline enqueues and executes. The registry maps the
 * source name stored on crawl_runs rows to the adapter that executes it.
 * Adding a source = implement DataSourceAdapter and register it here.
 */
export function getAdapterRegistry(): Record<string, DataSourceAdapter> {
  const weedmaps = new WeedmapsAdapter();
  return {
    [weedmaps.name]: weedmaps,
  };
}

export function enabledSources(): string[] {
  return Object.keys(getAdapterRegistry());
}
