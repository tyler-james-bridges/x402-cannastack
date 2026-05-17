import { ENDPOINTS, type EndpointSpec } from '@/lib/endpoints';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';

function paramSchema(p: EndpointSpec['params'][number]) {
  const base: Record<string, unknown> = {
    type: p.type === 'number' ? 'number' : 'string',
    description: p.description,
    example: p.example,
  };
  return base;
}

function buildSpec() {
  const paths: Record<string, unknown> = {};

  for (const ep of ENDPOINTS) {
    const required = ep.params.filter((p) => p.required).map((p) => p.name);
    const properties: Record<string, unknown> = {};
    for (const p of ep.params) properties[p.name] = paramSchema(p);

    paths[ep.path] = {
      post: {
        operationId: ep.name.replace(/-/g, '_'),
        summary: ep.summary,
        tags: ['cannastack'],
        'x-cannastack-price-usdc': ep.price_usdc,
        'x-x402-price-usdc': ep.price_usdc,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required,
                properties,
                example: ep.example_request,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { type: 'object', example: ep.example_response },
              },
            },
          },
          '400': {
            description: 'Bad request',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['ok', 'error'],
                  properties: {
                    ok: { type: 'boolean', example: false },
                    error: { type: 'string', example: "Missing 'strain'" },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  paths['/api/analytics'] = {
    get: {
      operationId: 'analytics_summary',
      summary: 'Public analytics: total requests, USDC settled 24h, top endpoints and locations.',
      tags: ['cannastack'],
      'x-cannastack-price-usdc': 0,
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
  };

  paths['/api/crawl/status'] = {
    get: {
      operationId: 'crawl_status',
      summary: 'Crawler health and recent runs across metros.',
      tags: ['cannastack'],
      'x-cannastack-price-usdc': 0,
      responses: {
        '200': {
          description: 'Success',
          content: { 'application/json': { schema: { type: 'object' } } },
        },
      },
    },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'cannastack',
      version: '1.0.0',
      description:
        'Agent-native cannabis data. Dispensary menus, prices, deals, and strain availability priced like an API call via x402. $0.02 per request, settled in USDC.',
      contact: { url: `${BASE}/docs` },
      license: { name: 'MIT' },
    },
    servers: [{ url: BASE }],
    paths,
    'x-x402': {
      version: '1',
      payment: { protocol: 'x402', asset: 'USDC' },
      manifest: `${BASE}/.well-known/x402.json`,
    },
  };
}

export async function GET() {
  return new Response(JSON.stringify(buildSpec(), null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=3600',
    },
  });
}
