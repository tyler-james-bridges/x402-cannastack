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
        'x-payment-info': {
          price: { mode: 'fixed', currency: 'USD', amount: ep.price_usdc.toFixed(6) },
          protocols: [{ x402: {} }],
        },
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
            description:
              'Success. Every response includes `next_actions`: ready-to-send follow-up calls (endpoint URL + complete JSON body + price) so agents can chain workflows without guessing parameters. Dispensary results include a `url` field linking to the shop page for ordering.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  example: ep.example_response,
                  properties: {
                    next_actions: {
                      type: 'array',
                      description:
                        'Suggested follow-up calls. POST `body` as-is to `url` (paying via x402 the same way) to continue the workflow.',
                      items: { $ref: '#/components/schemas/NextAction' },
                    },
                  },
                },
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
          '402': { description: 'Payment Required' },
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
      'x-guidance':
        'Use POST /api/strain-finder when the agent has a strain name and location. Use POST /api/price-compare for cheapest product-category comparisons. Use POST /api/deal-scout for active deals by category or location. Payable routes use x402 on Base USDC and return chainable next_actions.',
      contact: { url: `${BASE}/docs` },
      license: { name: 'MIT' },
    },
    servers: [{ url: BASE }],
    paths,
    components: {
      schemas: {
        NextAction: {
          type: 'object',
          description:
            'A ready-to-send follow-up call attached to every paid response so workflows never dead-end.',
          required: ['action', 'description', 'method', 'endpoint', 'url', 'price_usdc', 'body'],
          properties: {
            action: { type: 'string', example: 'compare-category' },
            description: {
              type: 'string',
              example: 'Compare all flower prices near Las Vegas to sanity-check these.',
            },
            method: { type: 'string', enum: ['POST'] },
            endpoint: { type: 'string', example: 'price-compare' },
            url: { type: 'string', example: `${BASE}/api/price-compare` },
            price_usdc: { type: 'number', example: 0.02 },
            body: {
              type: 'object',
              example: { category: 'flower', location: 'Las Vegas, NV' },
            },
          },
        },
      },
    },
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
