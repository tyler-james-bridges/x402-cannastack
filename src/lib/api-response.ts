import { NextResponse } from 'next/server';
import { RETIREMENT_MESSAGE } from '@/lib/endpoints';

const CORS_HEADERS: Record<string, string> = {
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers':
    'content-type, authorization, payment-signature, x-payment, x-x402-payment',
  'access-control-expose-headers':
    'x-cannastack-version, payment-required, payment-response, x-payment-response',
  'access-control-max-age': '86400',
};

export function apiHeaders(): Record<string, string> {
  return { ...CORS_HEADERS, 'x-cannastack-version': '1' };
}

export function retiredDataResponse() {
  return NextResponse.json(
    {
      ok: false,
      status: 'retired',
      error: RETIREMENT_MESSAGE,
      active_paid_data_endpoints: 0,
      docs: 'https://cannastack.0x402.sh/docs',
    },
    { status: 410, headers: apiHeaders() },
  );
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: apiHeaders() });
}
