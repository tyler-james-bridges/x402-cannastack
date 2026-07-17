import { RETIREMENT_MESSAGE } from '@/lib/endpoints';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

export async function GET() {
  return Response.json(
    {
      name: 'Cannastack',
      status: 'retired',
      description: RETIREMENT_MESSAGE,
      homepage: BASE,
      docs: `${BASE}/docs`,
      openapi: `${BASE}/openapi.json`,
      llms_txt: `${BASE}/llms.txt`,
      active_paid_data_endpoints: 0,
      payment: { protocol: 'x402', status: 'inactive' },
      endpoints: [],
    },
    { headers: { 'cache-control': 'public, max-age=3600' } },
  );
}
