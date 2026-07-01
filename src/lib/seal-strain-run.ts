import { CATEGORY_MAP } from './categories';
import type { EndpointSpec } from './endpoints';

type EndpointName = EndpointSpec['name'];
type SealEndpoint = Exclude<EndpointName, 'price-history'>;

export type StrainRunRoute = {
  ok: boolean;
  endpoint?: SealEndpoint;
  body?: Record<string, unknown>;
  reason: string;
  message?: string;
};

export type StrainRunCard = {
  ok: true;
  type: 'strain_run';
  title: 'Strain Run';
  header: { ask: string; resolved_location: string; endpoint?: SealEndpoint };
  rows: Array<{
    dispensary: string;
    item?: string;
    price?: number;
    distance_mi?: number;
    active_deal: boolean;
    url?: string;
  }>;
  summary: string;
  footer: 'powered by cannastack, $0.02 data call';
};

const CATEGORY_ALIASES: Array<[string, RegExp]> = Object.keys(CATEGORY_MAP).map((category) => [
  category,
  new RegExp(`\\b${category.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\\-/g, '[- ]?')}\\b`, 'i'),
]);

const VIBES: Array<[RegExp, { strain?: string; category?: string; reason: string }]> = [
  [/\b(sleep|bed|insomnia|knock me out)\b/i, { category: 'edibles', reason: 'sleep vibe mapped to edible deals' }],
  [/\b(energy|focus|productive|daytime)\b/i, { strain: 'Sour Diesel', reason: 'energy vibe mapped to Sour Diesel' }],
  [/\b(chill|relax|calm|anxiety)\b/i, { strain: 'Blue Dream', reason: 'chill vibe mapped to Blue Dream' }],
  [/\b(pain|sore|aches?)\b/i, { category: 'topicals', reason: 'pain vibe mapped to topicals' }],
];

function cleanText(value: string): string {
  return value.replace(/[?.!]+$/g, '').replace(/\s+/g, ' ').trim();
}

function extractLocation(ask: string): string | undefined {
  const match = ask.match(/\b(?:near|in|around)\s+(.+?)(?=\s+\b(?:under|below|for|with|tonight|today|tomorrow|right now|this week|deals?|specials?)\b|[?.!]|$)/i);
  const location = match ? cleanText(match[1]) : '';
  return location && !/^me$/i.test(location) ? location : undefined;
}

function extractRadius(ask: string): number | undefined {
  const match = ask.match(/\b(\d{1,2})\s*(?:mi|mile|miles)\b/i);
  return match ? Number(match[1]) : undefined;
}

function findCategory(ask: string): string | undefined {
  return CATEGORY_ALIASES.find(([, pattern]) => pattern.test(ask))?.[0];
}

function findVibe(ask: string) {
  return VIBES.find(([pattern]) => pattern.test(ask))?.[1];
}

function extractStrain(ask: string): string | undefined {
  const match = ask.match(/(?:find|where(?:'s| is| can i buy)?|get me|search for|cheapest)\s+(.+?)(?:\s+(?:near|in|around|under)\b|$)/i)
    ?? ask.match(/^(.+?)(?:\s+(?:near|in|around|under)\b|$)/i);
  const candidate = match ? cleanText(match[1].replace(/^the\s+/i, '')) : '';
  if (!candidate || findCategory(candidate) || /\b(deals?|specials?|something|anything)\b/i.test(candidate)) return undefined;
  return candidate;
}

function cleanBody(body: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== ''));
}

export function routeStrainRunAsk(ask: string): StrainRunRoute {
  const text = cleanText(ask);
  const location = extractLocation(text);
  const category = findCategory(text);
  const vibe = findVibe(text);
  const radius = extractRadius(text);

  if (!text) return { ok: false, reason: 'empty_ask', message: 'Ask for a strain or deal and include a city.' };
  if (!location) return { ok: false, reason: 'missing_location', message: 'Add a city or ZIP, for example "near Tempe, AZ".' };

  if (/\b(deals?|sale|specials?|tonight)\b/i.test(text) || (vibe?.category && !vibe.strain)) {
    return { ok: true, endpoint: 'deal-scout', body: cleanBody({ location, category: category ?? vibe?.category, radius }), reason: vibe?.reason ?? 'deal ask' };
  }

  if (/\b(compare|prices?|cheapest)\b/i.test(text) && category) {
    return { ok: true, endpoint: 'price-compare', body: cleanBody({ location, category, radius }), reason: 'category price ask' };
  }

  const strain = extractStrain(text) ?? vibe?.strain;
  if (strain) return { ok: true, endpoint: 'strain-finder', body: cleanBody({ strain, location, radius }), reason: vibe?.reason ?? 'strain ask' };

  return { ok: true, endpoint: 'deal-scout', body: cleanBody({ location, category, radius }), reason: 'default deal scout' };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function priceOf(row: Record<string, unknown>): number | undefined {
  return typeof row.price === 'number' && row.price > 0 ? row.price : undefined;
}

export function formatStrainRunCard(ask: string, response: Record<string, unknown>, endpoint?: SealEndpoint): StrainRunCard {
  const loc = asRecord(response.location);
  const resolved = String(loc.resolved || loc.query || 'location not resolved');
  const error = typeof response.error === 'string' ? response.error : undefined;
  const rawRows = Array.isArray(response.results) ? response.results.map(asRecord) : [];
  const rows = rawRows.map((result) => {
    const matches = Array.isArray(result.matches) ? result.matches.map(asRecord) : [];
    const deals = Array.isArray(result.deal_products) ? result.deal_products.map(asRecord) : [];
    const products = matches.length ? matches : deals;
    const item = products.length
      ? products.sort((a, b) => (priceOf(a) ?? Infinity) - (priceOf(b) ?? Infinity))[0]
      : result;
    return {
      dispensary: String(result.dispensary || 'Unknown dispensary'),
      item: item?.name ? String(item.name) : undefined,
      price: item ? priceOf(item) : undefined,
      distance_mi: typeof result.distance_mi === 'number' ? Number(result.distance_mi.toFixed(1)) : undefined,
      active_deal: Boolean(result.active_deal || deals.length),
      url: result.url || result.dispensary_url ? String(result.url || result.dispensary_url) : undefined,
    };
  }).sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity)).slice(0, 3);

  const cheapest = rows.find((row) => typeof row.price === 'number');
  const summary = rows.length === 0
    ? error ?? String(response.summary || 'No matching dispensaries found. Try a wider radius or a nearby city.')
    : `Cheapest: ${cheapest?.dispensary ?? rows[0].dispensary}${cheapest?.price ? ` at $${cheapest.price}` : ''}${cheapest?.distance_mi ? `, ${cheapest.distance_mi} mi away` : ''}.`;

  return {
    ok: true,
    type: 'strain_run',
    title: 'Strain Run',
    header: { ask, resolved_location: resolved, endpoint },
    rows,
    summary,
    footer: 'powered by cannastack, $0.02 data call',
  };
}
