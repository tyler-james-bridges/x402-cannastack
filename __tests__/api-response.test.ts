import { describe, it, expect } from 'vitest';
import { apiHeaders } from '@/lib/api-response';

describe('apiHeaders', () => {
  it('returns CORS headers', () => {
    const headers = apiHeaders();
    expect(headers['access-control-allow-origin']).toBe('*');
    expect(headers['access-control-allow-methods']).toContain('POST');
  });

  it('includes x-price-usdc when endpoint is specified', () => {
    const headers = apiHeaders({ endpoint: 'strain-finder' });
    expect(headers['x-price-usdc']).toBe('0.02');
  });

  it('includes x-cannastack-version', () => {
    const headers = apiHeaders();
    expect(headers['x-cannastack-version']).toBe('1');
  });
});

describe('badRequest shape', () => {
  // We test the function import indirectly since it returns NextResponse
  // which needs the Next.js runtime. We validate apiHeaders covers the
  // endpoint price scenario instead.
  it('apiHeaders omits price when no endpoint given', () => {
    const headers = apiHeaders();
    expect(headers['x-price-usdc']).toBeUndefined();
  });

  it('apiHeaders includes source when provided', () => {
    const headers = apiHeaders({ source: 'database', cache: 'hit' });
    expect(headers['x-source']).toBe('database');
    expect(headers['x-cache']).toBe('hit');
  });
});
