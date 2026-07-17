import { NextRequest, NextResponse } from 'next/server';
import { apiHeaders, preflight, retiredDataResponse } from '@/lib/api-response';
import { RETIREMENT_MESSAGE } from '@/lib/endpoints';

const RETIRED_PAGES = new Set([
  '/strain-finder',
  '/price-compare',
  '/deal-scout',
  '/price-history',
]);

function wantsJson(request: NextRequest): boolean {
  const accept = request.headers.get('accept') || '';
  return accept.includes('application/json') && !accept.includes('text/html');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/api/') && RETIRED_PAGES.has(pathname.slice(4))) {
    if (request.method === 'OPTIONS') return preflight();
    return retiredDataResponse();
  }

  if (RETIRED_PAGES.has(pathname)) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return retiredDataResponse();
    if (wantsJson(request)) return retiredDataResponse();
  }

  if (pathname === '/' && wantsJson(request)) {
    return NextResponse.json(
      {
        name: 'Cannastack',
        status: 'retired',
        message: RETIREMENT_MESSAGE,
        active_paid_data_endpoints: 0,
        endpoints: [],
        docs: 'https://cannastack.0x402.sh/docs',
        openapi: 'https://cannastack.0x402.sh/openapi.json',
        llms_txt: 'https://cannastack.0x402.sh/llms.txt',
        manifest: 'https://cannastack.0x402.sh/.well-known/x402.json',
        status_page: 'https://cannastack.0x402.sh/status',
      },
      { headers: apiHeaders() },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/strain-finder',
    '/price-compare',
    '/deal-scout',
    '/price-history',
    '/api/strain-finder',
    '/api/price-compare',
    '/api/deal-scout',
    '/api/price-history',
  ],
};
