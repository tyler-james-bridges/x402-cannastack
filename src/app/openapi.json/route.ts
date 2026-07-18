import { ENDPOINTS, type EndpointSpec } from '@/lib/endpoints';
import { discoveryHeaders } from '@/lib/api-response';

export const dynamic = 'force-static';

const BASE = 'https://cannastack.0x402.sh';
const DESCRIPTION =
  'Cannastack transiently processes caller-supplied menu snapshots. It does not provide, crawl, fetch, verify, store, or redistribute third-party inventory. Rights are caller-attested and unverified. Payment verification and settlement use an external facilitator and public Base transactions. Outputs make no inventory, orderability, live availability, medical, or quality claims.';

function schemaName(endpoint: EndpointSpec, kind: 'Request' | 'Response') {
  return `Menu${endpoint.operation[0].toUpperCase()}${endpoint.operation.slice(1)}${kind}`;
}

function rewriteSchemaRefs(value: unknown, schemaPath: string): unknown {
  if (Array.isArray(value)) return value.map((item) => rewriteSchemaRefs(item, schemaPath));
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === '$ref' && typeof child === 'string' && child.startsWith('#/$defs/')
        ? child.replace('#/$defs/', `${schemaPath}/$defs/`)
        : rewriteSchemaRefs(child, schemaPath),
    ]),
  );
}

const errorContent = {
  'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
};
const paymentResponseHeader = {
  description: 'Base64-encoded x402 v2 settlement result. Inspect before any payment retry.',
  schema: {
    type: 'string',
    contentEncoding: 'base64',
    contentMediaType: 'application/json',
  },
};

function uncharged(description: string) {
  return { description: `Uncharged. ${description}`, content: errorContent };
}

function buildSpec() {
  const paths: Record<string, unknown> = {};
  const schemas: Record<string, unknown> = {
    ErrorResponse: {
      type: 'object',
      additionalProperties: false,
      required: ['ok', 'error'],
      properties: {
        ok: { const: false },
        error: {
          type: 'object',
          additionalProperties: false,
          required: ['code'],
          properties: {
            code: { type: 'string' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['code', 'path'],
                properties: { code: { type: 'string' }, path: { type: 'string' } },
              },
            },
          },
        },
      },
    },
    PaymentRequired: {
      type: 'object',
      required: ['x402Version', 'resource', 'accepts'],
      properties: {
        x402Version: { const: 2 },
        error: { type: 'string' },
        resource: {
          type: 'object',
          required: ['url', 'description', 'mimeType'],
          properties: {
            url: { type: 'string', format: 'uri' },
            description: { type: 'string' },
            mimeType: { const: 'application/json' },
          },
        },
        accepts: {
          type: 'array',
          minItems: 1,
          items: {
            type: 'object',
            required: ['scheme', 'network', 'asset', 'amount', 'payTo', 'maxTimeoutSeconds', 'extra'],
            properties: {
              scheme: { const: 'exact' },
              network: { const: 'eip155:8453' },
              asset: { type: 'string' },
              amount: { type: 'string', pattern: '^[1-9][0-9]*$' },
              payTo: { type: 'string', pattern: '^0x[0-9a-fA-F]{40}$' },
              maxTimeoutSeconds: { type: 'integer', minimum: 1 },
              extra: { type: 'object', additionalProperties: true },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: true,
    },
  };

  for (const endpoint of ENDPOINTS) {
    const requestName = schemaName(endpoint, 'Request');
    const responseName = schemaName(endpoint, 'Response');
    schemas[requestName] = rewriteSchemaRefs(
      endpoint.request_schema,
      `#/components/schemas/${requestName}`,
    );
    schemas[responseName] = rewriteSchemaRefs(
      endpoint.response_schema,
      `#/components/schemas/${responseName}`,
    );

    paths[endpoint.path] = {
      post: {
        operationId: endpoint.name.replaceAll('-', '_'),
        summary: endpoint.summary,
        description:
          'Processes only the menu snapshot in this request. Input rights are caller-attested and unverified. Processing is transient, with no external menu data access or application storage. Payment verification and settlement use an external facilitator and public Base transactions.',
        tags: ['menu-processing'],
        parameters: [
          {
            in: 'header',
            name: 'PAYMENT-SIGNATURE',
            required: false,
            description: 'Base64-encoded x402 v2 payment payload supplied when retrying a valid 402 challenge.',
            schema: { type: 'string', contentEncoding: 'base64' },
          },
        ],
        'x-x402': {
          version: 2,
          price: endpoint.price,
          price_usdc: endpoint.price_usdc,
          asset: endpoint.asset,
          network: endpoint.network,
          scheme: endpoint.scheme,
        },
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: `#/components/schemas/${requestName}` } },
          },
        },
        responses: {
          '200': {
            description:
              'Processed result with caller-supplied, unverified provenance and no inventory or availability claim.',
            headers: { 'PAYMENT-RESPONSE': paymentResponseHeader },
            content: {
              'application/json': { schema: { $ref: `#/components/schemas/${responseName}` } },
            },
          },
          '400': uncharged('The body, JSON, or Content-Length is malformed.'),
          '403': uncharged('The required caller rights attestation is absent or invalid.'),
          '413': uncharged('The body or a declared collection limit is exceeded.'),
          '415': uncharged('The media type or content encoding is unsupported.'),
          '422': uncharged('The JSON does not satisfy the operation request schema.'),
          '402': {
            description:
              'Payment required after request validation. PAYMENT-REQUIRED contains the base64-encoded x402 v2 challenge, and the JSON body contains the same challenge decoded for body-oriented clients.',
            headers: {
              'PAYMENT-REQUIRED': {
                description: 'Base64-encoded JSON matching the decoded response body.',
                schema: {
                  type: 'string',
                  contentEncoding: 'base64',
                  contentMediaType: 'application/json',
                },
              },
            },
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/PaymentRequired' } },
            },
            'x-body-mirrors-header': 'PAYMENT-REQUIRED',
          },
          '500': {
            description: 'Menu processing failed.',
            content: errorContent,
          },
          '502': {
            description:
              'Payment service unavailable, or settlement outcome indeterminate. If error.code is payment_settlement_indeterminate, do not submit a new payment authorization until PAYMENT-RESPONSE and the public onchain state confirm the original authorization did not settle.',
            headers: { 'PAYMENT-RESPONSE': paymentResponseHeader },
            content: errorContent,
          },
          '503': {
            description: 'Payment configuration is unavailable.',
            content: errorContent,
          },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: {
      title: 'Cannastack caller-supplied menu processors',
      version: '1.0.0',
      description: DESCRIPTION,
    },
    servers: [{ url: BASE }],
    tags: [{ name: 'menu-processing', description: 'Source-neutral menu snapshot processing.' }],
    paths,
    components: { schemas },
    'x-service-status': {
      contract: 'published',
      availability: 'not_asserted',
      paymentReadiness: 'evaluated_per_request',
      publishedPaidEndpoints: ENDPOINTS.length,
      input: 'caller_supplied_menu_snapshots_only',
      externalMenuDataAccess: false,
      applicationStorage: false,
      rightsVerification: 'not_performed',
    },
    'x-x402': {
      version: 2,
      publishedPaidEndpoints: ENDPOINTS.length,
      serviceCatalog: `${BASE}/.well-known/x402.json`,
      challengeSource: 'runtime_http_402',
    },
  };
}

export async function GET() {
  return Response.json(buildSpec(), {
    headers: discoveryHeaders(),
  });
}
