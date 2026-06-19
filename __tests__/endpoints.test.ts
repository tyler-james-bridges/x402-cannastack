import { describe, it, expect } from 'vitest';
import { ENDPOINTS, findEndpoint } from '@/lib/endpoints';

describe('ENDPOINTS', () => {
  it('defines exactly 4 endpoints', () => {
    expect(ENDPOINTS).toHaveLength(4);
  });

  it('includes all expected endpoint names', () => {
    const names = ENDPOINTS.map((e) => e.name);
    expect(names).toContain('strain-finder');
    expect(names).toContain('price-compare');
    expect(names).toContain('deal-scout');
    expect(names).toContain('price-history');
  });

  it('every endpoint has a price in USDC', () => {
    for (const ep of ENDPOINTS) {
      expect(ep.price_usdc).toBeGreaterThan(0);
    }
  });
});

describe('findEndpoint', () => {
  it('returns the correct endpoint by name', () => {
    const ep = findEndpoint('strain-finder');
    expect(ep).toBeDefined();
    expect(ep!.path).toBe('/api/strain-finder');
  });

  it('returns undefined for an unknown name', () => {
    expect(findEndpoint('nonexistent')).toBeUndefined();
  });
});
