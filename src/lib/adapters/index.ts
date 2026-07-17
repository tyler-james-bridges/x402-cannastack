import type { DataSourceAdapter } from '../types';

/**
 * Authorized sources may be registered here in the future. An empty registry
 * keeps the provider-neutral pipeline inert by default.
 */
export function getAdapterRegistry(): Record<string, DataSourceAdapter> {
  return {};
}

export function enabledSources(): string[] {
  return Object.keys(getAdapterRegistry());
}
