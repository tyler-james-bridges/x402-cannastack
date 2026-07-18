import { z } from 'zod';

export const MENU_SCHEMA_VERSION = 'cannastack.byom.v1' as const;
export const DATA_RIGHTS_VERSION = 'cannastack.data-rights.v1' as const;
export const MENU_RULESET_VERSION = 'cannastack.byom.rules.v1' as const;

export const MENU_LIMITS = Object.freeze({
  bodyBytes: 512 * 1024,
  menus: 25,
  itemsPerMenu: 250,
  totalItems: 500,
  offersPerItem: 8,
  totalOffers: 1_000,
  tagsPerItem: 12,
  filterValues: 20,
  compareResults: 100,
  recommendResults: 25,
  validationIssues: 25,
  maxPriceMinorUnits: 1_000_000,
  maxPackageBaseAmount: 999_999_999,
  normalizedTextExpansionFactor: 24,
});

export const CANONICAL_CATEGORIES = [
  'flower',
  'pre-roll',
  'vape',
  'concentrate',
  'edible',
  'beverage',
  'tincture',
  'topical',
  'capsule',
  'accessory',
  'other',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];
export type MenuOperation = 'normalize' | 'compare' | 'recommend';
export type RightsBasis = 'owner' | 'license' | 'other_authorization';
export type PackageDimension = 'mass' | 'volume' | 'count';

const DISALLOWED_TEXT = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/u;
export const MONEY_PATTERN = '^(?:0\\.(?:0[1-9]|[1-9][0-9]?)|[1-9][0-9]{0,3}(?:\\.[0-9]{1,2})?|10000(?:\\.0{1,2})?)$';
export const SCALED_PACKAGE_PATTERN = '^(?:0\\.(?:00[1-9]|0[1-9][0-9]?|[1-9][0-9]{0,2})|[1-9][0-9]{0,5}(?:\\.[0-9]{1,3})?)$';
export const INTEGER_PACKAGE_PATTERN = '^[1-9][0-9]{0,8}$';
const MONEY_DECIMAL = new RegExp(MONEY_PATTERN, 'u');
const SCALED_DECIMAL = new RegExp(SCALED_PACKAGE_PATTERN, 'u');
const INTEGER_DECIMAL = new RegExp(INTEGER_PACKAGE_PATTERN, 'u');

export function normalizeText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

export function matchingKey(value: string): string {
  return normalizeText(value).toLowerCase();
}

function textSchema(maxLength: number, asciiOnly = false) {
  return z.string().superRefine((value, context) => {
    const normalized = normalizeText(value);
    const normalizedLimit = maxLength * MENU_LIMITS.normalizedTextExpansionFactor;
    if (
      normalized.length === 0 ||
      Array.from(value).length > maxLength ||
      Array.from(normalized).length > normalizedLimit ||
      Array.from(normalized.toLowerCase()).length > normalizedLimit ||
      DISALLOWED_TEXT.test(value) ||
      (asciiOnly && !PRINTABLE_ASCII.test(value))
    ) {
      context.addIssue({ code: 'custom', message: 'invalid_text' });
    }
  });
}

const identifierSchema = textSchema(64, true);
const nameSchema = textSchema(160);
const shortNameSchema = textSchema(120);
const labelSchema = textSchema(40);

function decimalToInteger(value: string, scale: number): bigint {
  const [whole, fraction = ''] = value.split('.');
  return (
    BigInt(whole) * BigInt(10) ** BigInt(scale) + BigInt(fraction.padEnd(scale, '0'))
  );
}

export function moneyToMinorUnits(amount: string): number {
  return Number(decimalToInteger(amount, 2));
}

export function packageToBaseAmount(value: string, unit: 'mg' | 'g' | 'ml' | 'each') {
  return Number(decimalToInteger(value, unit === 'g' || unit === 'ml' ? 3 : 0));
}

const moneySchema = z
  .object({ currency: z.literal('USD'), amount: z.string().max(8).regex(MONEY_DECIMAL) })
  .strict()
  .superRefine(({ amount }, context) => {
    if (amount.length > 8 || !MONEY_DECIMAL.test(amount)) return;
    const minorUnits = moneyToMinorUnits(amount);
    if (minorUnits < 1 || minorUnits > MENU_LIMITS.maxPriceMinorUnits) {
      context.addIssue({ code: 'custom', path: ['amount'], message: 'invalid_amount' });
    }
  });

function packageValueSchema(pattern: RegExp, scale: number) {
  return z.string().max(10).regex(pattern).superRefine((value, context) => {
    if (value.length > 10 || !pattern.test(value)) return;
    const amount = decimalToInteger(value, scale);
    if (amount < BigInt(1) || amount > BigInt(MENU_LIMITS.maxPackageBaseAmount)) {
      context.addIssue({ code: 'custom', message: 'invalid_package_size' });
    }
  });
}

const packageSizeSchema = z.discriminatedUnion('unit', [
  z.object({ value: packageValueSchema(INTEGER_DECIMAL, 0), unit: z.literal('mg') }).strict(),
  z.object({ value: packageValueSchema(SCALED_DECIMAL, 3), unit: z.literal('g') }).strict(),
  z.object({ value: packageValueSchema(SCALED_DECIMAL, 3), unit: z.literal('ml') }).strict(),
  z.object({ value: packageValueSchema(INTEGER_DECIMAL, 0), unit: z.literal('each') }).strict(),
]);

const offerSchema = z
  .object({
    offer_id: identifierSchema,
    price: moneySchema,
    package_size: packageSizeSchema.optional(),
  })
  .strict();

const itemSchema = z
  .object({
    item_id: identifierSchema,
    name: nameSchema,
    brand: shortNameSchema.optional(),
    category: labelSchema,
    tags: z.array(labelSchema).max(MENU_LIMITS.tagsPerItem).default([]),
    offers: z.array(offerSchema).max(MENU_LIMITS.offersPerItem),
  })
  .strict();

const menuSchema = z
  .object({
    menu_id: identifierSchema,
    menu_name: shortNameSchema.optional(),
    items: z.array(itemSchema).max(MENU_LIMITS.itemsPerMenu),
  })
  .strict();

const authorizationSchema = z
  .object({
    version: z.literal(DATA_RIGHTS_VERSION),
    rights_basis: z.enum(['owner', 'license', 'other_authorization']),
    submitter_has_rights: z.literal(true),
    contains_personal_data: z.literal(false),
  })
  .strict();

const baseRequestShape = {
  schema_version: z.literal(MENU_SCHEMA_VERSION),
  data_authorization: authorizationSchema,
  menus: z.array(menuSchema).max(MENU_LIMITS.menus),
};

const canonicalCategorySchema = z.enum(CANONICAL_CATEGORIES);
const matchValuesSchema = z.array(labelSchema).max(MENU_LIMITS.filterValues).default([]);
const brandValuesSchema = z.array(shortNameSchema).max(MENU_LIMITS.filterValues).default([]);

const priceBasisSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('package') }).strict(),
  z
    .object({
      type: z.literal('unit'),
      dimension: z.enum(['mass', 'volume', 'count']),
    })
    .strict(),
]);

export const normalizeRequestSchema = z.object(baseRequestShape).strict();

export const compareRequestSchema = z
  .object({
    ...baseRequestShape,
    filter: z
      .object({
        category: canonicalCategorySchema.optional(),
        name: nameSchema.optional(),
        brand: shortNameSchema.optional(),
        tags_all: matchValuesSchema,
      })
      .strict()
      .superRefine((filter, context) => {
        if (filter.category === undefined && filter.name === undefined) {
          context.addIssue({ code: 'custom', message: 'category_or_name_required' });
        }
      }),
    basis: priceBasisSchema,
    limit: z.number().int().min(1).max(MENU_LIMITS.compareResults).default(100),
  })
  .strict();

const recommendCategories = CANONICAL_CATEGORIES.filter(
  (category): category is Exclude<CanonicalCategory, 'other'> => category !== 'other',
);

export const recommendRequestSchema = z
  .object({
    ...baseRequestShape,
    constraints: z
      .object({
        category: z.enum(recommendCategories),
        max_price: moneySchema.optional(),
        tags_all: matchValuesSchema,
      })
      .strict(),
    preferences: z
      .object({ brands: brandValuesSchema, tags: matchValuesSchema })
      .strict()
      .superRefine((preferences, context) => {
        if (preferences.brands.length === 0 && preferences.tags.length === 0) {
          context.addIssue({ code: 'custom', message: 'preference_required' });
        }
      }),
    basis: priceBasisSchema,
    limit: z.number().int().min(1).max(MENU_LIMITS.recommendResults).default(25),
  })
  .strict();

export type NormalizeRequest = z.infer<typeof normalizeRequestSchema>;
export type BaseRequest = NormalizeRequest;
export type CompareRequest = z.infer<typeof compareRequestSchema>;
export type RecommendRequest = z.infer<typeof recommendRequestSchema>;
export type DataAuthorization = z.infer<typeof authorizationSchema>;
export type MoneyInput = z.infer<typeof moneySchema>;
export type PackageSizeInput = z.infer<typeof packageSizeSchema>;
export type ParsedMenuRequest = NormalizeRequest | CompareRequest | RecommendRequest;
export type PriceBasis = z.infer<typeof priceBasisSchema>;
export type MenuInput = NormalizeRequest['menus'][number];
export type ItemInput = MenuInput['items'][number];
export type OfferInput = ItemInput['offers'][number];

export type MenuValidationIssue = {
  code: string;
  path: string;
};

export type MenuValidationError = {
  status: 403 | 413 | 422;
  code: string;
  issues: MenuValidationIssue[];
};

export type MenuValidationResult<T extends ParsedMenuRequest = ParsedMenuRequest> =
  | { success: true; data: T }
  | { success: false; error: MenuValidationError };

const requestSchemas = {
  normalize: normalizeRequestSchema,
  compare: compareRequestSchema,
  recommend: recommendRequestSchema,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidAttestation(input: unknown): boolean {
  if (!isRecord(input) || !isRecord(input.data_authorization)) return false;
  const authorization = input.data_authorization;
  return (
    authorization.version === DATA_RIGHTS_VERSION &&
    ['owner', 'license', 'other_authorization'].includes(
      authorization.rights_basis as string,
    ) &&
    authorization.submitter_has_rights === true &&
    authorization.contains_personal_data === false
  );
}

function pointer(path: readonly PropertyKey[]): string {
  if (path.length === 0) return '';
  return `/${path
    .map((part) => String(part).replace(/~/gu, '~0').replace(/\//gu, '~1'))
    .join('/')}`;
}

function zodIssueCode(issue: z.core.$ZodIssue): string {
  if (issue.code === 'unrecognized_keys') return 'unknown_field';
  if (issue.code === 'too_big') return 'limit_exceeded';
  if (issue.code === 'invalid_type') return 'invalid_type';
  return 'invalid_value';
}

function isCollectionLimit(issue: z.core.$ZodIssue): boolean {
  if (issue.code !== 'too_big') return false;
  const last = issue.path.at(-1);
  return (
    issue.origin === 'array' ||
    last === 'limit' ||
    last === 'menus' ||
    last === 'items' ||
    last === 'offers' ||
    last === 'tags' ||
    last === 'tags_all' ||
    last === 'brands'
  );
}

function duplicateIdentifierIssues(request: ParsedMenuRequest): MenuValidationIssue[] {
  const issues: MenuValidationIssue[] = [];
  const menuIds = new Set<string>();

  request.menus.forEach((menu, menuIndex) => {
    const menuId = normalizeText(menu.menu_id);
    if (menuIds.has(menuId)) {
      issues.push({ code: 'duplicate_id', path: `/menus/${menuIndex}/menu_id` });
    }
    menuIds.add(menuId);

    const itemIds = new Set<string>();
    menu.items.forEach((item, itemIndex) => {
      const itemId = normalizeText(item.item_id);
      if (itemIds.has(itemId)) {
        issues.push({
          code: 'duplicate_id',
          path: `/menus/${menuIndex}/items/${itemIndex}/item_id`,
        });
      }
      itemIds.add(itemId);

      const offerIds = new Set<string>();
      item.offers.forEach((offer, offerIndex) => {
        const offerId = normalizeText(offer.offer_id);
        if (offerIds.has(offerId)) {
          issues.push({
            code: 'duplicate_id',
            path: `/menus/${menuIndex}/items/${itemIndex}/offers/${offerIndex}/offer_id`,
          });
        }
        offerIds.add(offerId);
      });
    });
  });

  return issues.slice(0, MENU_LIMITS.validationIssues);
}

function aggregateLimitIssue(request: ParsedMenuRequest): MenuValidationIssue | undefined {
  let itemCount = 0;
  let offerCount = 0;
  for (const menu of request.menus) {
    itemCount += menu.items.length;
    for (const item of menu.items) offerCount += item.offers.length;
  }
  if (itemCount > MENU_LIMITS.totalItems) {
    return { code: 'limit_exceeded', path: '/menus/items' };
  }
  if (offerCount > MENU_LIMITS.totalOffers) {
    return { code: 'limit_exceeded', path: '/menus/items/offers' };
  }
  return undefined;
}

function arrayLimitAt(
  value: unknown,
  maximum: number,
  path: string,
): MenuValidationIssue | undefined {
  return Array.isArray(value) && value.length > maximum
    ? { code: 'limit_exceeded', path }
    : undefined;
}

function operationCollectionLimitIssue(
  input: Record<string, unknown>,
  operation: MenuOperation,
) {
  const filter = isRecord(input.filter) ? input.filter : undefined;
  const constraints = isRecord(input.constraints) ? input.constraints : undefined;
  const preferences = isRecord(input.preferences) ? input.preferences : undefined;
  if (operation === 'compare') {
    return arrayLimitAt(filter?.tags_all, MENU_LIMITS.filterValues, '/filter/tags_all');
  }
  if (operation !== 'recommend') return undefined;
  return arrayLimitAt(constraints?.tags_all, MENU_LIMITS.filterValues, '/constraints/tags_all') ??
    arrayLimitAt(preferences?.brands, MENU_LIMITS.filterValues, '/preferences/brands') ??
    arrayLimitAt(preferences?.tags, MENU_LIMITS.filterValues, '/preferences/tags');
}

function collectionLimitIssue(
  input: unknown,
  operation: MenuOperation,
): MenuValidationIssue | undefined {
  if (!isRecord(input)) return undefined;
  const operationIssue = operationCollectionLimitIssue(input, operation);
  if (operationIssue) return operationIssue;
  if (!Array.isArray(input.menus)) return undefined;
  if (input.menus.length > MENU_LIMITS.menus) {
    return { code: 'limit_exceeded', path: '/menus' };
  }

  let itemCount = 0;
  let offerCount = 0;
  for (const [menuIndex, menu] of input.menus.entries()) {
    if (!isRecord(menu) || !Array.isArray(menu.items)) continue;
    if (menu.items.length > MENU_LIMITS.itemsPerMenu) {
      return { code: 'limit_exceeded', path: `/menus/${menuIndex}/items` };
    }
    itemCount += menu.items.length;
    if (itemCount > MENU_LIMITS.totalItems) {
      return { code: 'limit_exceeded', path: '/menus/items' };
    }

    for (const [itemIndex, item] of menu.items.entries()) {
      if (!isRecord(item)) continue;
      if (Array.isArray(item.tags) && item.tags.length > MENU_LIMITS.tagsPerItem) {
        return { code: 'limit_exceeded', path: `/menus/${menuIndex}/items/${itemIndex}/tags` };
      }
      if (!Array.isArray(item.offers)) continue;
      if (item.offers.length > MENU_LIMITS.offersPerItem) {
        return { code: 'limit_exceeded', path: `/menus/${menuIndex}/items/${itemIndex}/offers` };
      }
      offerCount += item.offers.length;
      if (offerCount > MENU_LIMITS.totalOffers) {
        return { code: 'limit_exceeded', path: '/menus/items/offers' };
      }
    }
  }
  return undefined;
}

export function validateMenuRequest<O extends MenuOperation>(
  operation: O,
  input: unknown,
): MenuValidationResult<
  O extends 'normalize'
    ? NormalizeRequest
    : O extends 'compare'
      ? CompareRequest
      : RecommendRequest
> {
  if (isRecord(input) && !hasValidAttestation(input)) {
    return {
      success: false,
      error: {
        status: 403,
        code: 'data_authorization_required',
        issues: [{ code: 'invalid_attestation', path: '/data_authorization' }],
      },
    };
  }

  const collectionIssue = collectionLimitIssue(input, operation);
  if (collectionIssue) {
    return {
      success: false,
      error: {
        status: 413,
        code: 'request_limit_exceeded',
        issues: [collectionIssue],
      },
    };
  }

  const result = requestSchemas[operation].safeParse(input);
  if (!result.success) {
    const issues = result.error.issues.slice(0, MENU_LIMITS.validationIssues);
    const status = issues.some(isCollectionLimit) ? 413 : 422;
    return {
      success: false,
      error: {
        status,
        code: status === 413 ? 'request_limit_exceeded' : 'invalid_request',
        issues: issues.map((issue) => ({
          code: zodIssueCode(issue),
          path: pointer(issue.path),
        })),
      },
    };
  }

  const request = result.data as ParsedMenuRequest;
  const aggregateIssue = aggregateLimitIssue(request);
  if (aggregateIssue) {
    return {
      success: false,
      error: {
        status: 413,
        code: 'request_limit_exceeded',
        issues: [aggregateIssue],
      },
    };
  }

  const duplicateIssues = duplicateIdentifierIssues(request);
  if (duplicateIssues.length > 0) {
    return {
      success: false,
      error: { status: 422, code: 'invalid_request', issues: duplicateIssues },
    };
  }

  return { success: true, data: result.data as never };
}
