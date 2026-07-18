import {
  CANONICAL_CATEGORIES,
  DATA_RIGHTS_VERSION,
  INTEGER_PACKAGE_PATTERN,
  MENU_LIMITS,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
  MONEY_PATTERN,
  SCALED_PACKAGE_PATTERN,
} from '@/lib/menu-contract';

export const RETIREMENT_MESSAGE =
  'Legacy Cannastack retrieval routes are retired and do not serve third-party data.';

type JsonSchema = Record<string, unknown>;

export type EndpointSpec = {
  name: 'menu-normalize' | 'menu-compare' | 'menu-recommend';
  operation: 'normalize' | 'compare' | 'recommend';
  path: string;
  method: 'POST';
  price: '$0.02';
  price_usdc: 0.02;
  asset: 'USDC';
  network: 'eip155:8453';
  scheme: 'exact';
  summary: string;
  request_schema: JsonSchema;
  response_schema: JsonSchema;
  limits: typeof MENU_LIMITS;
};

const identifierSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 64,
  pattern: '^(?=.*[^ ])[ -~]+$',
  'x-normalization': 'NFKC trim collapse_whitespace',
};
const textSchema = (maxLength: number) => ({
  type: 'string',
  minLength: 1,
  maxLength,
  pattern: '^(?=[\\s\\S]*\\S)[^\\p{Cc}\\p{Cf}\\p{Cs}]+$',
  'x-normalization': 'NFKC trim collapse_whitespace',
});
const normalizedTextSchema = (inputMaxLength: number) => ({
  type: 'string',
  minLength: 1,
  maxLength: inputMaxLength * MENU_LIMITS.normalizedTextExpansionFactor,
  pattern: '^(?=[\\s\\S]*\\S)[^\\p{Cc}\\p{Cf}\\p{Cs}]+$',
});
const stringArray = (maxItems: number, itemMaxLength: number) => ({
  type: 'array',
  maxItems,
  items: textSchema(itemMaxLength),
});
const normalizedStringArray = (maxItems: number, itemMaxLength: number) => ({
  type: 'array',
  maxItems,
  items: normalizedTextSchema(itemMaxLength),
});

const requestDefinitions = {
  data_authorization: {
    type: 'object',
    additionalProperties: false,
    required: ['version', 'rights_basis', 'submitter_has_rights', 'contains_personal_data'],
    properties: {
      version: { const: DATA_RIGHTS_VERSION },
      rights_basis: { enum: ['owner', 'license', 'other_authorization'] },
      submitter_has_rights: { const: true },
      contains_personal_data: { const: false },
    },
  },
  money: {
    type: 'object',
    additionalProperties: false,
    required: ['currency', 'amount'],
    properties: {
      currency: { const: 'USD' },
      amount: {
        type: 'string',
        maxLength: 8,
        pattern: MONEY_PATTERN,
      },
    },
  },
  package_size: {
    oneOf: [
      ['mg', 'each'].map((unit) => ({
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: { type: 'string', maxLength: 9, pattern: INTEGER_PACKAGE_PATTERN },
          unit: { const: unit },
        },
      })),
      ['g', 'ml'].map((unit) => ({
        type: 'object',
        additionalProperties: false,
        required: ['value', 'unit'],
        properties: {
          value: {
            type: 'string',
            maxLength: 10,
            pattern: SCALED_PACKAGE_PATTERN,
          },
          unit: { const: unit },
        },
      })),
    ].flat(),
  },
  offer: {
    type: 'object',
    additionalProperties: false,
    required: ['offer_id', 'price'],
    properties: {
      offer_id: identifierSchema,
      price: { $ref: '#/$defs/money' },
      package_size: { $ref: '#/$defs/package_size' },
    },
  },
  item: {
    type: 'object',
    additionalProperties: false,
    required: ['item_id', 'name', 'category', 'offers'],
    properties: {
      item_id: identifierSchema,
      name: textSchema(160),
      brand: textSchema(120),
      category: textSchema(40),
      tags: stringArray(MENU_LIMITS.tagsPerItem, 40),
      offers: {
        type: 'array',
        maxItems: MENU_LIMITS.offersPerItem,
        items: { $ref: '#/$defs/offer' },
      },
    },
  },
  menu: {
    type: 'object',
    additionalProperties: false,
    required: ['menu_id', 'items'],
    properties: {
      menu_id: identifierSchema,
      menu_name: textSchema(120),
      items: {
        type: 'array',
        maxItems: MENU_LIMITS.itemsPerMenu,
        items: { $ref: '#/$defs/item' },
      },
    },
  },
  basis: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['type'],
        properties: { type: { const: 'package' } },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'dimension'],
        properties: {
          type: { const: 'unit' },
          dimension: { enum: ['mass', 'volume', 'count'] },
        },
      },
    ],
  },
};

function requestSchema(properties: JsonSchema, required: string[]): JsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['schema_version', 'data_authorization', 'menus', ...required],
    properties: {
      schema_version: { const: MENU_SCHEMA_VERSION },
      data_authorization: { $ref: '#/$defs/data_authorization' },
      menus: {
        type: 'array',
        maxItems: MENU_LIMITS.menus,
        items: { $ref: '#/$defs/menu' },
      },
      ...properties,
    },
    $defs: requestDefinitions,
    'x-total-items-maximum': MENU_LIMITS.totalItems,
    'x-total-offers-maximum': MENU_LIMITS.totalOffers,
    'x-body-bytes-maximum': MENU_LIMITS.bodyBytes,
  };
}

const responseDefinitions = {
  provenance: {
    type: 'object',
    additionalProperties: false,
    required: [
      'source_kind',
      'authorization_status',
      'rights_basis',
      'canonical_input_sha256',
      'schema_version',
      'ruleset_version',
      'external_menu_data_used',
      'inventory_verification',
      'processing',
    ],
    properties: {
      source_kind: { const: 'caller_supplied' },
      authorization_status: { const: 'caller_attested_unverified' },
      rights_basis: { enum: ['owner', 'license', 'other_authorization'] },
      canonical_input_sha256: { type: 'string', pattern: '^sha256:[a-f0-9]{64}$' },
      schema_version: { const: MENU_SCHEMA_VERSION },
      ruleset_version: { const: MENU_RULESET_VERSION },
      external_menu_data_used: { const: false },
      inventory_verification: { const: 'not_performed' },
      processing: { const: 'transient_no_application_storage' },
    },
  },
  package_size: {
    oneOf: [
      { type: 'null' },
      {
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'base_amount', 'base_unit'],
        properties: {
          dimension: { const: 'mass' },
          base_amount: {
            type: 'integer',
            minimum: 1,
            maximum: MENU_LIMITS.maxPackageBaseAmount,
          },
          base_unit: { const: 'mg' },
        },
      },
      ...[
        ['volume', 'microliter'],
        ['count', 'each'],
      ].map(([dimension, baseUnit]) => ({
        type: 'object',
        additionalProperties: false,
        required: ['dimension', 'base_amount', 'base_unit'],
        properties: {
          dimension: { const: dimension },
          base_amount: {
            type: 'integer',
            minimum: 1,
            maximum: MENU_LIMITS.maxPackageBaseAmount,
          },
          base_unit: { const: baseUnit },
        },
      })),
    ],
  },
  declared_price: {
    type: 'object',
    additionalProperties: false,
    required: ['currency', 'minor_units'],
    properties: {
      currency: { const: 'USD' },
      minor_units: {
        type: 'integer',
        minimum: 1,
        maximum: MENU_LIMITS.maxPriceMinorUnits,
      },
    },
  },
  canonical_offer: {
    type: 'object',
    additionalProperties: false,
    required: ['offer_id', 'declared_price', 'package_size'],
    properties: {
      offer_id: identifierSchema,
      declared_price: { $ref: '#/$defs/declared_price' },
      package_size: { $ref: '#/$defs/package_size' },
    },
  },
  canonical_item: {
    type: 'object',
    additionalProperties: false,
    required: [
      'item_id',
      'name',
      'name_key',
      'brand',
      'brand_key',
      'category',
      'source_category',
      'declared_tags',
      'offers',
    ],
    properties: {
      item_id: identifierSchema,
      name: normalizedTextSchema(160),
      name_key: normalizedTextSchema(160),
      brand: { oneOf: [{ type: 'null' }, normalizedTextSchema(120)] },
      brand_key: { oneOf: [{ type: 'null' }, normalizedTextSchema(120)] },
      category: { enum: CANONICAL_CATEGORIES },
      source_category: normalizedTextSchema(40),
      declared_tags: normalizedStringArray(MENU_LIMITS.tagsPerItem, 40),
      offers: {
        type: 'array',
        maxItems: MENU_LIMITS.offersPerItem,
        items: { $ref: '#/$defs/canonical_offer' },
      },
    },
  },
  canonical_menu: {
    type: 'object',
    additionalProperties: false,
    required: ['menu_id', 'menu_name', 'items'],
    properties: {
      menu_id: identifierSchema,
      menu_name: { oneOf: [{ type: 'null' }, normalizedTextSchema(120)] },
      items: {
        type: 'array',
        maxItems: MENU_LIMITS.itemsPerMenu,
        items: { $ref: '#/$defs/canonical_item' },
      },
    },
  },
  ranked_result: {
    type: 'object',
    required: [
      'menu_id',
      'item_id',
      'offer_id',
      'name',
      'brand',
      'category',
      'source_category',
      'declared_tags',
      'declared_price',
      'package_size',
      'comparison',
    ],
    properties: {
      menu_id: identifierSchema,
      item_id: identifierSchema,
      offer_id: identifierSchema,
      name: normalizedTextSchema(160),
      brand: { oneOf: [{ type: 'null' }, normalizedTextSchema(120)] },
      category: { enum: CANONICAL_CATEGORIES },
      source_category: normalizedTextSchema(40),
      declared_tags: normalizedStringArray(MENU_LIMITS.tagsPerItem, 40),
      declared_price: { $ref: '#/$defs/declared_price' },
      package_size: { $ref: '#/$defs/package_size' },
      comparison: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type'],
            properties: {
              type: { const: 'package' },
            },
          },
          ...[
            ['mass', 'mg'],
            ['volume', 'microliter'],
            ['count', 'each'],
          ].map(([dimension, baseUnit]) => ({
            type: 'object',
            additionalProperties: false,
            required: [
              'type',
              'dimension',
              'base_unit',
            ],
            properties: {
              type: { const: 'unit' },
              dimension: { const: dimension },
              base_unit: { const: baseUnit },
            },
          })),
        ],
      },
    },
    allOf: [
      ['mass', 'mg'],
      ['volume', 'microliter'],
      ['count', 'each'],
    ].map(([dimension, baseUnit]) => ({
      if: {
        properties: {
          comparison: {
            properties: { type: { const: 'unit' }, dimension: { const: dimension } },
            required: ['type', 'dimension'],
          },
        },
      },
      then: {
        properties: {
          package_size: {
            type: 'object',
            properties: {
              dimension: { const: dimension },
              base_unit: { const: baseUnit },
            },
            required: ['dimension', 'base_unit'],
          },
        },
      },
    })),
  },
};

function responseSchema(
  operation: EndpointSpec['operation'],
  resultSchema: JsonSchema,
  extraProperties: JsonSchema = {},
): JsonSchema {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['ok', 'operation', ...Object.keys(extraProperties), ...Object.keys(resultSchema), 'provenance'],
    properties: {
      ok: { const: true },
      operation: { const: operation },
      ...extraProperties,
      ...resultSchema,
      provenance: { $ref: '#/$defs/provenance' },
    },
    $defs: responseDefinitions,
  };
}

const basisResponseSchema = {
  oneOf: [
    {
      type: 'object',
      additionalProperties: false,
      required: ['type'],
      properties: { type: { const: 'package' } },
    },
    {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'dimension'],
      properties: {
        type: { const: 'unit' },
        dimension: { enum: ['mass', 'volume', 'count'] },
      },
    },
  ],
};

function basisResultConstraints() {
  return [
    { type: 'package' },
    { type: 'unit', dimension: 'mass' },
    { type: 'unit', dimension: 'volume' },
    { type: 'unit', dimension: 'count' },
  ].map((basis) => ({
    if: {
      properties: { basis: { properties: { type: { const: basis.type }, ...(basis.dimension ? { dimension: { const: basis.dimension } } : {}) } } },
      required: ['basis'],
    },
    then: {
      properties: {
        results: {
          items: {
            properties: {
              comparison: {
                properties: {
                  type: { const: basis.type },
                  ...(basis.dimension ? { dimension: { const: basis.dimension } } : {}),
                },
                required: basis.dimension ? ['type', 'dimension'] : ['type'],
              },
            },
          },
        },
      },
    },
  }));
}

const normalizeRequest = requestSchema({}, []);
const compareRequest = requestSchema(
  {
    filter: {
      type: 'object',
      additionalProperties: false,
      anyOf: [{ required: ['category'] }, { required: ['name'] }],
      properties: {
        category: { enum: CANONICAL_CATEGORIES },
        name: textSchema(160),
        brand: textSchema(120),
        tags_all: stringArray(MENU_LIMITS.filterValues, 40),
      },
    },
    basis: { $ref: '#/$defs/basis' },
    limit: { type: 'integer', minimum: 1, maximum: MENU_LIMITS.compareResults, default: 100 },
  },
  ['filter', 'basis'],
);
const recommendRequest = requestSchema(
  {
    constraints: {
      type: 'object',
      additionalProperties: false,
      required: ['category'],
      properties: {
        category: { enum: CANONICAL_CATEGORIES.filter((category) => category !== 'other') },
        max_price: { $ref: '#/$defs/money' },
        tags_all: stringArray(MENU_LIMITS.filterValues, 40),
      },
    },
    preferences: {
      type: 'object',
      additionalProperties: false,
      anyOf: [
        { required: ['brands'], properties: { brands: { minItems: 1 } } },
        { required: ['tags'], properties: { tags: { minItems: 1 } } },
      ],
      properties: {
        brands: stringArray(MENU_LIMITS.filterValues, 120),
        tags: stringArray(MENU_LIMITS.filterValues, 40),
      },
    },
    basis: { $ref: '#/$defs/basis' },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: MENU_LIMITS.recommendResults,
      default: 25,
    },
  },
  ['constraints', 'preferences', 'basis'],
);

const normalizeResponse = responseSchema('normalize', {
  menus: {
    type: 'array',
    maxItems: MENU_LIMITS.menus,
    items: { $ref: '#/$defs/canonical_menu' },
  },
  warnings: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'menu_id', 'item_id'],
      properties: {
        code: { const: 'category_mapped_to_other' },
        menu_id: identifierSchema,
        item_id: identifierSchema,
      },
    },
  },
});

const compareResponse = {
  ...responseSchema('compare', {
    results: {
      type: 'array',
      maxItems: MENU_LIMITS.compareResults,
      items: {
        allOf: [{ $ref: '#/$defs/ranked_result' }],
        unevaluatedProperties: false,
      },
    },
  }, { basis: basisResponseSchema }),
  allOf: basisResultConstraints(),
};

const recommendResponse = {
  ...responseSchema('recommend', {
    results: {
      type: 'array',
      maxItems: MENU_LIMITS.recommendResults,
      items: {
        allOf: [
          { $ref: '#/$defs/ranked_result' },
          {
            type: 'object',
            required: ['match_codes'],
            properties: {
              match_codes: {
                type: 'array',
                maxItems: MENU_LIMITS.tagsPerItem + 1,
                items: { enum: ['preferred_brand_exact', 'preferred_tag_exact'] },
              },
            },
          },
        ],
        unevaluatedProperties: false,
      },
    },
  }, { basis: basisResponseSchema }),
  allOf: basisResultConstraints(),
};

export const ENDPOINTS: readonly EndpointSpec[] = Object.freeze([
  {
    name: 'menu-normalize',
    operation: 'normalize',
    path: '/api/v1/menu/normalize',
    method: 'POST',
    price: '$0.02',
    price_usdc: 0.02,
    asset: 'USDC',
    network: 'eip155:8453',
    scheme: 'exact',
    summary: 'Canonicalize a caller-supplied menu snapshot.',
    request_schema: normalizeRequest,
    response_schema: normalizeResponse,
    limits: MENU_LIMITS,
  },
  {
    name: 'menu-compare',
    operation: 'compare',
    path: '/api/v1/menu/compare',
    method: 'POST',
    price: '$0.02',
    price_usdc: 0.02,
    asset: 'USDC',
    network: 'eip155:8453',
    scheme: 'exact',
    summary: 'Compare exact prices within caller-supplied menus.',
    request_schema: compareRequest,
    response_schema: compareResponse,
    limits: MENU_LIMITS,
  },
  {
    name: 'menu-recommend',
    operation: 'recommend',
    path: '/api/v1/menu/recommend',
    method: 'POST',
    price: '$0.02',
    price_usdc: 0.02,
    asset: 'USDC',
    network: 'eip155:8453',
    scheme: 'exact',
    summary: 'Rank caller-supplied items by exact declared preferences.',
    request_schema: recommendRequest,
    response_schema: recommendResponse,
    limits: MENU_LIMITS,
  },
]);

export function findEndpoint(name: string): EndpointSpec | undefined {
  return ENDPOINTS.find((endpoint) => endpoint.name === name);
}
