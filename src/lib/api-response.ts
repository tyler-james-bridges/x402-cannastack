import { NextResponse } from 'next/server';
import { ENDPOINTS, RETIREMENT_MESSAGE } from '@/lib/endpoints';

const CORS_HEADERS: Record<string, string> = {
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'content-type, authorization, payment-signature, x-payment, x-x402-payment',
  'access-control-expose-headers':
    'x-cannastack-version, payment-required, payment-response, x-payment-response',
  'access-control-max-age': '86400',
};

export function apiHeaders(
  methods = 'GET, HEAD, POST, OPTIONS',
): Record<string, string> {
  return {
    ...CORS_HEADERS,
    'access-control-allow-methods': methods,
    'x-cannastack-version': '1',
  };
}

export function mergeApiHeaders<T extends Response>(response: T, methods?: string): T {
  for (const [name, value] of Object.entries(apiHeaders(methods))) {
    response.headers.set(name, value);
  }
  return response;
}

export function retiredDataResponse() {
  return NextResponse.json(
    {
      ok: false,
      status: 'retired',
      error: RETIREMENT_MESSAGE,
      published_paid_endpoints: ENDPOINTS.length,
      docs: 'https://cannastack.0x402.sh/docs',
    },
    { status: 410, headers: apiHeaders() },
  );
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: apiHeaders() });
}

export function menuPreflight() {
  return new NextResponse(null, { status: 204, headers: apiHeaders('POST, OPTIONS') });
}

export function discoveryHeaders(contentType?: string): Record<string, string> {
  return {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=3600',
    ...(contentType ? { 'content-type': contentType } : {}),
  };
}
