import type { DataSourceAdapter } from '../types';
import { WeedmapsAdapter } from './weedmaps';
// import { LeaflyAdapter } from './leafly';
// Leafly adapter is ready but disabled until their public API is confirmed working.
// Uncomment the import and the registry entry below to enable.

/**
 * Sources the crawl pipeline enqueues and executes. The registry maps the
 * source name stored on crawl_runs rows to the adapter that executes it.
 */
export function getAdapterRegistry(): Record<string, DataSourceAdapter> {
  const weedmaps = new WeedmapsAdapter();
  return {
    [weedmaps.name]: weedmaps,
    // leafly: new LeaflyAdapter(),
  };
}

export function enabledSources(): string[] {
  return Object.keys(getAdapterRegistry());
}
