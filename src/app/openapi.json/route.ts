import { RETIREMENT_MESSAGE } from '@/lib/endpoints';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

export async function GET() {
  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Cannastack',
      version: '2.0.0',
      description: RETIREMENT_MESSAGE,
    },
    servers: [{ url: BASE }],
    paths: {},
    'x-service-status': {
      status: 'retired',
      activePaidDataEndpoints: 0,
      reason: 'Pending an authorized provider.',
    },
    'x-x402': {
      status: 'inactive',
      activePaidEndpoints: 0,
      manifest: `${BASE}/.well-known/x402.json`,
    },
  };

  return Response.json(spec, {
    headers: { 'cache-control': 'public, max-age=3600' },
  });
}
