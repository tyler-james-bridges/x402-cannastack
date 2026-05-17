import { NextRequest, NextResponse } from 'next/server';

const ENDPOINT_PAGES: Record<string, string> = {
  '/strain-finder': '/api/strain-finder',
  '/price-compare': '/api/price-compare',
  '/deal-scout': '/api/deal-scout',
  '/price-history': '/api/price-history',
};

const ROOT_POINTERS = {
  docs: 'https://cannastack.0x402.sh/docs',
  openapi: 'https://cannastack.0x402.sh/openapi.json',
  llms_txt: 'https://cannastack.0x402.sh/llms.txt',
  manifest: 'https://cannastack.0x402.sh/.well-known/x402.json',
  status: 'https://cannastack.0x402.sh/api/analytics',
};

function wantsJson(req: NextRequest): boolean {
  const accept = req.headers.get('accept') || '';
  // Treat as agent only when JSON is explicit AND HTML is not requested.
  if (accept.includes('text/html')) return false;
  return accept.includes('application/json');
}

const CORS_BASE = {
  'access-control-allow-origin': '*',
  'access-control-expose-headers': 'x-cannastack-version',
  'x-cannastack-version': '1',
};

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/' && wantsJson(req)) {
    return NextResponse.json(
      {
        name: 'cannastack',
        message: 'Agent endpoint. See /docs for human docs, /openapi.json for machine.',
        ...ROOT_POINTERS,
      },
      { headers: CORS_BASE },
    );
  }

  const api = ENDPOINT_PAGES[pathname];
  if (api && wantsJson(req)) {
    return NextResponse.json(
      {
        message: `This is a human page. Call ${api} via POST to use this endpoint as an agent.`,
        method: 'POST',
        api: `https://cannastack.0x402.sh${api}`,
        docs: `https://cannastack.0x402.sh/docs#${pathname.slice(1)}`,
        openapi: ROOT_POINTERS.openapi,
        manifest: ROOT_POINTERS.manifest,
      },
      { headers: CORS_BASE },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/strain-finder', '/price-compare', '/deal-scout', '/price-history'],
};
