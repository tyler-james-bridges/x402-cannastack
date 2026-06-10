import { NextResponse } from 'next/server';
import { findEndpoint } from '@/lib/endpoints';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type, x-payment, x-x402-payment, authorization',
  'access-control-expose-headers':
    'x-price-usdc, x-source, x-cache, x-response-ms, x-cannastack-version',
  'access-control-max-age': '86400',
};

export type EndpointName =
  | 'strain-finder'
  | 'price-compare'
  | 'deal-scout'
  | 'price-history';

type Meta = {
  endpoint?: EndpointName;
  source?: 'database' | 'live' | 'cache';
  cache?: 'hit' | 'miss';
  responseMs?: number;
};

export function apiHeaders(meta: Meta = {}): Record<string, string> {
  const headers: Record<string, string> = { ...CORS_HEADERS, 'x-cannastack-version': '1' };
  if (meta.endpoint) {
    const ep = findEndpoint(meta.endpoint);
    if (ep) headers['x-price-usdc'] = ep.price_usdc.toFixed(2);
  }
  if (meta.source) headers['x-source'] = meta.source;
  if (meta.cache) headers['x-cache'] = meta.cache;
  if (typeof meta.responseMs === 'number') headers['x-response-ms'] = String(meta.responseMs);
  return headers;
}

export function ok<T>(data: T, meta: Meta = {}) {
  return NextResponse.json(data, { headers: apiHeaders(meta) });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: apiHeaders() });
}

export function badRequest(
  message: string,
  endpoint: EndpointName,
  extra: Record<string, unknown> = {},
) {
  const ep = findEndpoint(endpoint);
  return NextResponse.json(
    {
      ok: false,
      error: message,
      endpoint,
      docs: `https://cannastack.0x402.sh/docs#${endpoint}`,
      example_request: ep?.example_request,
      ...extra,
    },
    { status: 400, headers: apiHeaders({ endpoint }) },
  );
}

export function serverError(message: string, endpoint: EndpointName) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      endpoint,
      docs: `https://cannastack.0x402.sh/docs#${endpoint}`,
    },
    { status: 500, headers: apiHeaders({ endpoint }) },
  );
}
