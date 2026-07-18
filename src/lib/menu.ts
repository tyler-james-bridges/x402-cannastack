import { createHash } from 'node:crypto';

import {
  DATA_RIGHTS_VERSION,
  MENU_RULESET_VERSION,
  MENU_SCHEMA_VERSION,
  matchingKey,
  moneyToMinorUnits,
  normalizeText,
  packageToBaseAmount,
  type CanonicalCategory,
  type CompareRequest,
  type MenuInput,
  type MenuOperation,
  type NormalizeRequest,
  type ParsedMenuRequest,
  type PriceBasis,
  type RecommendRequest,
  type RightsBasis,
} from '@/lib/menu-contract';

export const CATEGORY_ALIASES: Readonly<Record<string, CanonicalCategory>> = Object.freeze({
  flower: 'flower',
  flowers: 'flower',
  'pre-roll': 'pre-roll',
  'pre-rolls': 'pre-roll',
  'pre roll': 'pre-roll',
  'pre rolls': 'pre-roll',
  preroll: 'pre-roll',
  prerolls: 'pre-roll',
  vape: 'vape',
  vapes: 'vape',
  concentrate: 'concentrate',
  concentrates: 'concentrate',
  edible: 'edible',
  edibles: 'edible',
  beverage: 'beverage',
  beverages: 'beverage',
  tincture: 'tincture',
  tinctures: 'tincture',
  topical: 'topical',
  topicals: 'topical',
  capsule: 'capsule',
  capsules: 'capsule',
  accessory: 'accessory',
  accessories: 'accessory',
  other: 'other',
});

function categoryAlias(value: string): CanonicalCategory | undefined {
  const key = matchingKey(value);
  return Object.hasOwn(CATEGORY_ALIASES, key) ? CATEGORY_ALIASES[key] : undefined;
}

export type CanonicalPackageSize =
  | { dimension: 'mass'; base_amount: number; base_unit: 'mg' }
  | { dimension: 'volume'; base_amount: number; base_unit: 'microliter' }
  | { dimension: 'count'; base_amount: number; base_unit: 'each' };

export type CanonicalOffer = {
  offer_id: string;
  declared_price: { currency: 'USD'; minor_units: number };
  package_size: CanonicalPackageSize | null;
};

export type CanonicalItem = {
  item_id: string;
  name: string;
  name_key: string;
  brand: string | null;
  brand_key: string | null;
  category: CanonicalCategory;
  source_category: string;
  declared_tags: string[];
  offers: CanonicalOffer[];
};

export type CanonicalMenu = {
  menu_id: string;
  menu_name: string | null;
  items: CanonicalItem[];
};

export type Provenance = {
  source_kind: 'caller_supplied';
  authorization_status: 'caller_attested_unverified';
  rights_basis: RightsBasis;
  canonical_input_sha256: `sha256:${string}`;
  schema_version: typeof MENU_SCHEMA_VERSION;
  ruleset_version: typeof MENU_RULESET_VERSION;
  external_menu_data_used: false;
  inventory_verification: 'not_performed';
  processing: 'transient_no_application_storage';
};

function compareStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedUnique(values: readonly string[], key = matchingKey): string[] {
  return [...new Set(values.map(key))].sort(compareStrings);
}

function canonicalPackageSize(
  packageSize: MenuInput['items'][number]['offers'][number]['package_size'],
): CanonicalPackageSize | null {
  if (!packageSize) return null;
  if (packageSize.unit === 'mg' || packageSize.unit === 'g') {
    return {
      dimension: 'mass',
      base_amount: packageToBaseAmount(packageSize.value, packageSize.unit),
      base_unit: 'mg',
    };
  }
  if (packageSize.unit === 'ml') {
    return {
      dimension: 'volume',
      base_amount: packageToBaseAmount(packageSize.value, packageSize.unit),
      base_unit: 'microliter',
    };
  }
  return {
    dimension: 'count',
    base_amount: packageToBaseAmount(packageSize.value, packageSize.unit),
    base_unit: 'each',
  };
}

export function canonicalizeMenus(menus: readonly MenuInput[]): CanonicalMenu[] {
  return menus
    .map((menu) => ({
      menu_id: normalizeText(menu.menu_id),
      menu_name: menu.menu_name === undefined ? null : normalizeText(menu.menu_name),
      items: menu.items
        .map((item) => {
          const sourceCategory = normalizeText(item.category);
          const category = categoryAlias(sourceCategory) ?? 'other';
          const brand = item.brand === undefined ? null : normalizeText(item.brand);
          return {
            item_id: normalizeText(item.item_id),
            name: normalizeText(item.name),
            name_key: matchingKey(item.name),
            brand,
            brand_key: brand === null ? null : matchingKey(brand),
            category,
            source_category: sourceCategory,
            declared_tags: sortedUnique(item.tags),
            offers: item.offers
              .map((offer) => ({
                offer_id: normalizeText(offer.offer_id),
                declared_price: {
                  currency: 'USD' as const,
                  minor_units: moneyToMinorUnits(offer.price.amount),
                },
                package_size: canonicalPackageSize(offer.package_size),
              }))
              .sort((left, right) => compareStrings(left.offer_id, right.offer_id)),
          };
        })
        .sort((left, right) => compareStrings(left.item_id, right.item_id)),
    }))
    .sort((left, right) => compareStrings(left.menu_id, right.menu_id));
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => compareStrings(left, right));
  return `{${entries
    .map(([name, entry]) => `${JSON.stringify(name)}:${stableJson(entry)}`)
    .join(',')}}`;
}

function canonicalBasis(basis: PriceBasis) {
  return basis.type === 'package'
    ? { type: 'package' as const }
    : { type: 'unit' as const, dimension: basis.dimension };
}

function canonicalRequest(operation: MenuOperation, request: ParsedMenuRequest) {
  const common = {
    schema_version: MENU_SCHEMA_VERSION,
    data_authorization: {
      version: DATA_RIGHTS_VERSION,
      rights_basis: request.data_authorization.rights_basis,
      submitter_has_rights: true,
      contains_personal_data: false,
    },
    menus: canonicalizeMenus(request.menus),
  };

  if (operation === 'normalize') return common;
  if (operation === 'compare') {
    const compareRequest = request as CompareRequest;
    return {
      ...common,
      filter: {
        category: compareRequest.filter.category ?? null,
        name_key:
          compareRequest.filter.name === undefined
            ? null
            : matchingKey(compareRequest.filter.name),
        brand_key:
          compareRequest.filter.brand === undefined
            ? null
            : matchingKey(compareRequest.filter.brand),
        tags_all: sortedUnique(compareRequest.filter.tags_all),
      },
      basis: canonicalBasis(compareRequest.basis),
      limit: compareRequest.limit,
    };
  }

  const recommendRequest = request as RecommendRequest;
  return {
    ...common,
    constraints: {
      category: recommendRequest.constraints.category,
      max_price_minor_units: recommendRequest.constraints.max_price
        ? moneyToMinorUnits(recommendRequest.constraints.max_price.amount)
        : null,
      tags_all: sortedUnique(recommendRequest.constraints.tags_all),
    },
    preferences: {
      brands: sortedUnique(recommendRequest.preferences.brands),
      tags: sortedUnique(recommendRequest.preferences.tags),
    },
    basis: canonicalBasis(recommendRequest.basis),
    limit: recommendRequest.limit,
  };
}

function provenance(operation: MenuOperation, request: ParsedMenuRequest): Provenance {
  const digest = createHash('sha256')
    .update(stableJson(canonicalRequest(operation, request)), 'utf8')
    .digest('hex');
  return {
    source_kind: 'caller_supplied',
    authorization_status: 'caller_attested_unverified',
    rights_basis: request.data_authorization.rights_basis,
    canonical_input_sha256: `sha256:${digest}`,
    schema_version: MENU_SCHEMA_VERSION,
    ruleset_version: MENU_RULESET_VERSION,
    external_menu_data_used: false,
    inventory_verification: 'not_performed',
    processing: 'transient_no_application_storage',
  };
}

export function normalizeMenu(request: NormalizeRequest) {
  const menus = canonicalizeMenus(request.menus);
  const warnings = menus.flatMap((menu) =>
    menu.items
      .filter(
        (item) =>
          item.category === 'other' && categoryAlias(item.source_category) === undefined,
      )
      .map((item) => ({
        code: 'category_mapped_to_other' as const,
        menu_id: menu.menu_id,
        item_id: item.item_id,
      })),
  );
  return {
    ok: true as const,
    operation: 'normalize' as const,
    menus,
    warnings,
    provenance: provenance('normalize', request),
  };
}

type ResultRecord = {
  menu_id: string;
  item_id: string;
  offer_id: string;
  name: string;
  brand: string | null;
  category: CanonicalCategory;
  source_category: string;
  declared_tags: string[];
  declared_price: CanonicalOffer['declared_price'];
  package_size: CanonicalPackageSize | null;
};

type Candidate = {
  menu: CanonicalMenu;
  item: CanonicalItem;
  offer: CanonicalOffer;
};

function resultRecord(candidate: Candidate): ResultRecord {
  return {
    menu_id: candidate.menu.menu_id,
    item_id: candidate.item.item_id,
    offer_id: candidate.offer.offer_id,
    name: candidate.item.name,
    brand: candidate.item.brand,
    category: candidate.item.category,
    source_category: candidate.item.source_category,
    declared_tags: candidate.item.declared_tags,
    declared_price: candidate.offer.declared_price,
    package_size: candidate.offer.package_size,
  };
}

function compareCandidateIds(left: Candidate, right: Candidate): number {
  return (
    compareStrings(left.menu.menu_id, right.menu.menu_id) ||
    compareStrings(left.item.item_id, right.item.item_id) ||
    compareStrings(left.offer.offer_id, right.offer.offer_id)
  );
}

function compareExactPrice(left: Candidate, right: Candidate, basis: PriceBasis): number {
  if (basis.type === 'package') {
    return left.offer.declared_price.minor_units - right.offer.declared_price.minor_units;
  }
  const leftAmount = left.offer.package_size?.base_amount;
  const rightAmount = right.offer.package_size?.base_amount;
  if (leftAmount === undefined || rightAmount === undefined) return 0;
  const leftRatio = BigInt(left.offer.declared_price.minor_units) * BigInt(rightAmount);
  const rightRatio = BigInt(right.offer.declared_price.minor_units) * BigInt(leftAmount);
  return leftRatio < rightRatio ? -1 : leftRatio > rightRatio ? 1 : 0;
}

function eligibleForBasis(offer: CanonicalOffer, basis: PriceBasis): boolean {
  return (
    basis.type === 'package' ||
    (offer.package_size !== null && offer.package_size.dimension === basis.dimension)
  );
}

function comparisonRecord(offer: CanonicalOffer, basis: PriceBasis) {
  if (basis.type === 'package') {
    return {
      type: 'package' as const,
    };
  }
  const packageSize = offer.package_size as CanonicalPackageSize;
  return {
    type: 'unit' as const,
    dimension: basis.dimension,
    base_unit: packageSize.base_unit,
  };
}

function allCandidates(menus: readonly CanonicalMenu[]): Candidate[] {
  return menus.flatMap((menu) =>
    menu.items.flatMap((item) => item.offers.map((offer) => ({ menu, item, offer }))),
  );
}

export function compareMenu(request: CompareRequest) {
  const menus = canonicalizeMenus(request.menus);
  const nameKey = request.filter.name ? matchingKey(request.filter.name) : null;
  const brandKey = request.filter.brand ? matchingKey(request.filter.brand) : null;
  const requiredTags = sortedUnique(request.filter.tags_all);

  const candidates = allCandidates(menus)
    .filter(({ item, offer }) => {
      const tags = new Set(item.declared_tags);
      return (
        (request.filter.category === undefined || item.category === request.filter.category) &&
        (nameKey === null || item.name_key === nameKey) &&
        (brandKey === null || item.brand_key === brandKey) &&
        requiredTags.every((tag) => tags.has(tag)) &&
        eligibleForBasis(offer, request.basis)
      );
    })
    .sort(
      (left, right) =>
        compareExactPrice(left, right, request.basis) || compareCandidateIds(left, right),
    )
    .slice(0, request.limit);

  return {
    ok: true as const,
    operation: 'compare' as const,
    basis: canonicalBasis(request.basis),
    results: candidates.map((candidate) => ({
      ...resultRecord(candidate),
      comparison: comparisonRecord(candidate.offer, request.basis),
    })),
    provenance: provenance('compare', request),
  };
}

type RecommendationCandidate = Candidate & {
  match_codes: ('preferred_brand_exact' | 'preferred_tag_exact')[];
};

function bestOffer(
  menu: CanonicalMenu,
  item: CanonicalItem,
  basis: PriceBasis,
  maxPriceMinorUnits: number | null,
): Candidate | undefined {
  return item.offers
    .filter(
      (offer) =>
        eligibleForBasis(offer, basis) &&
        (maxPriceMinorUnits === null ||
          offer.declared_price.minor_units <= maxPriceMinorUnits),
    )
    .map((offer) => ({ menu, item, offer }))
    .sort(
      (left, right) =>
        compareExactPrice(left, right, basis) ||
        compareStrings(left.offer.offer_id, right.offer.offer_id),
    )[0];
}

export function recommendMenu(request: RecommendRequest) {
  const menus = canonicalizeMenus(request.menus);
  const requiredTags = sortedUnique(request.constraints.tags_all);
  const preferredBrands = new Set(sortedUnique(request.preferences.brands));
  const preferredTags = new Set(sortedUnique(request.preferences.tags));
  const maxPriceMinorUnits = request.constraints.max_price
    ? moneyToMinorUnits(request.constraints.max_price.amount)
    : null;
  const candidates: RecommendationCandidate[] = [];

  for (const menu of menus) {
    for (const item of menu.items) {
      const tags = new Set(item.declared_tags);
      if (
        item.category !== request.constraints.category ||
        !requiredTags.every((tag) => tags.has(tag))
      ) {
        continue;
      }
      const candidate = bestOffer(menu, item, request.basis, maxPriceMinorUnits);
      if (!candidate) continue;
      const matchCodes: RecommendationCandidate['match_codes'] = [];
      if (item.brand_key !== null && preferredBrands.has(item.brand_key)) {
        matchCodes.push('preferred_brand_exact');
      }
      for (const tag of item.declared_tags) {
        if (preferredTags.has(tag)) matchCodes.push('preferred_tag_exact');
      }
      candidates.push({ ...candidate, match_codes: matchCodes });
    }
  }

  candidates.sort(
    (left, right) =>
      right.match_codes.length - left.match_codes.length ||
      compareExactPrice(left, right, request.basis) ||
      compareCandidateIds(left, right),
  );

  return {
    ok: true as const,
    operation: 'recommend' as const,
    basis: canonicalBasis(request.basis),
    results: candidates.slice(0, request.limit).map((candidate) => ({
      ...resultRecord(candidate),
      comparison: comparisonRecord(candidate.offer, request.basis),
      match_codes: candidate.match_codes,
    })),
    provenance: provenance('recommend', request),
  };
}

export function processMenuRequest(operation: MenuOperation, request: ParsedMenuRequest) {
  if (operation === 'normalize') return normalizeMenu(request as NormalizeRequest);
  if (operation === 'compare') return compareMenu(request as CompareRequest);
  return recommendMenu(request as RecommendRequest);
}
