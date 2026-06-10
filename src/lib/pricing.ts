export type PriceUnit =
  | 'unit'
  | 'eighth'
  | 'gram'
  | 'quarter'
  | 'half_ounce'
  | 'ounce'
  | 'unknown';

const PRICE_FIELDS: [string, PriceUnit][] = [
  ['price_unit', 'unit'],
  ['price_eighth', 'eighth'],
  ['price_gram', 'gram'],
  ['price_quarter', 'quarter'],
  ['price_half_ounce', 'half_ounce'],
  ['price_ounce', 'ounce'],
];

// First positive price across the unit ladder. Rows missing some price
// columns (e.g. deal queries only select unit/eighth) fall through safely.
export function bestPrice(row: Record<string, unknown>): { price: number; unit: PriceUnit } {
  for (const [field, unit] of PRICE_FIELDS) {
    const value = Number(row[field]);
    if (value > 0) return { price: value, unit };
  }
  return { price: 0, unit: 'unknown' };
}

export function bestPriceValue(row: Record<string, unknown>): number {
  return bestPrice(row).price;
}
