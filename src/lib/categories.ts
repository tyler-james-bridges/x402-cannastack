// Maps user-facing category aliases to the category values stored in menu_items.
// Shared by price-compare and deal-scout so synonyms never drift between endpoints.
export const CATEGORY_MAP: Record<string, string[]> = {
  flower: ['flower'],
  edibles: ['edibles'],
  edible: ['edibles'],
  vape: ['vape pens'],
  vapes: ['vape pens'],
  'vape pens': ['vape pens'],
  cartridge: ['vape pens'],
  concentrate: ['concentrates'],
  concentrates: ['concentrates'],
  dab: ['concentrates'],
  'pre-roll': ['pre-rolls', 'pre roll', 'infused pre roll'],
  'pre-rolls': ['pre-rolls', 'pre roll', 'infused pre roll'],
  preroll: ['pre-rolls', 'pre roll', 'infused pre roll'],
  prerolls: ['pre-rolls', 'pre roll', 'infused pre roll'],
  joint: ['pre-rolls', 'pre roll', 'infused pre roll'],
  drink: ['drinks'],
  drinks: ['drinks'],
  beverage: ['drinks'],
  tincture: ['tinctures'],
  tinctures: ['tinctures'],
  topical: ['topicals'],
  topicals: ['topicals'],
  wellness: ['wellness'],
};

export const CATEGORY_OPTIONS =
  'flower, edibles, vape, concentrates, pre-rolls, drinks, tinctures, topicals, wellness';
