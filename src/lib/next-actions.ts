import { findEndpoint, type EndpointSpec } from './endpoints';

const BASE = 'https://cannastack.0x402.sh';

/**
 * A ready-to-send follow-up call attached to every paid response, so an agent
 * (or the web UI) never dead-ends on a result. `body` is complete — POST it
 * as-is to `url` (paying the same way) to continue the workflow.
 */
export interface NextAction {
  action: string;
  description: string;
  method: 'POST';
  endpoint: EndpointSpec['name'];
  url: string;
  price_usdc: number;
  body: Record<string, unknown>;
}

function act(
  action: string,
  description: string,
  endpoint: EndpointSpec['name'],
  body: Record<string, unknown>,
): NextAction {
  const spec = findEndpoint(endpoint);
  return {
    action,
    description,
    method: 'POST',
    endpoint,
    url: `${BASE}/api/${endpoint}`,
    price_usdc: spec?.price_usdc ?? 0.02,
    body,
  };
}

// Strip undefined/empty values so bodies stay copy-paste clean.
function clean(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}

export function nextForStrainFinder(input: {
  strain: string;
  location: string;
  radius: number;
  resultCount: number;
  topCategory?: string;
}): NextAction[] {
  const { strain, location, radius, resultCount, topCategory } = input;

  if (resultCount === 0) {
    return [
      act(
        'widen-radius',
        `No matches within ${radius} miles — retry the same search at 50 miles.`,
        'strain-finder',
        clean({ strain, location, radius: 50 }),
      ),
      act(
        'browse-deals',
        `See which dispensaries near ${location} have active deals instead.`,
        'deal-scout',
        clean({ location }),
      ),
    ];
  }

  return [
    act(
      'price-history',
      `Is "${strain}" trending up or down? 30-day price history.`,
      'price-history',
      clean({ strain, location, days: 30 }),
    ),
    act(
      'compare-category',
      `Compare all ${topCategory || 'flower'} prices near ${location} to sanity-check these.`,
      'price-compare',
      clean({ category: topCategory || 'flower', location }),
    ),
    act(
      'browse-deals',
      `Check active deals near ${location} before buying.`,
      'deal-scout',
      clean({ location }),
    ),
  ];
}

export function nextForPriceCompare(input: {
  category: string;
  location: string;
  cheapestName?: string;
}): NextAction[] {
  const { category, location, cheapestName } = input;
  const actions: NextAction[] = [];

  if (cheapestName) {
    actions.push(
      act(
        'find-cheapest-item',
        `Find "${cheapestName}" at every dispensary near ${location}.`,
        'strain-finder',
        clean({ strain: cheapestName, location }),
      ),
    );
  }
  actions.push(
    act(
      'browse-deals',
      `See ${category} deals near ${location}.`,
      'deal-scout',
      clean({ location, category }),
    ),
    act(
      'price-history',
      `30-day ${category} price trend near ${location}.`,
      'price-history',
      clean({ category, location, days: 30 }),
    ),
  );
  return actions;
}

export function nextForDealScout(input: {
  location: string;
  category?: string;
  bestProductName?: string;
}): NextAction[] {
  const { location, category, bestProductName } = input;
  const actions: NextAction[] = [];

  if (bestProductName) {
    actions.push(
      act(
        'find-best-deal-item',
        `Is "${bestProductName}" cheaper anywhere else near ${location}?`,
        'strain-finder',
        clean({ strain: bestProductName, location }),
      ),
    );
  }
  actions.push(
    act(
      'compare-category',
      `Compare ${category || 'flower'} prices near ${location} to see how good these deals are.`,
      'price-compare',
      clean({ category: category || 'flower', location }),
    ),
    act(
      'price-history',
      `30-day ${category || 'flower'} price trend near ${location}.`,
      'price-history',
      clean({ category: category || 'flower', location, days: 30 }),
    ),
  );
  return actions;
}

export function nextForPriceHistory(input: {
  strain?: string;
  dispensary?: string;
  category?: string;
  location?: string;
}): NextAction[] {
  const { strain, dispensary, category, location } = input;
  const actions: NextAction[] = [];

  if (strain && location) {
    actions.push(
      act(
        'find-now',
        `Find "${strain}" near ${location} at today's prices.`,
        'strain-finder',
        clean({ strain, location }),
      ),
    );
  }
  if (location) {
    actions.push(
      act(
        'browse-deals',
        `Check active ${category ? `${category} ` : ''}deals near ${location}.`,
        'deal-scout',
        clean({ location, category }),
      ),
      act(
        'compare-category',
        `Today's ${category || 'flower'} price spread near ${location}.`,
        'price-compare',
        clean({ category: category || 'flower', location }),
      ),
    );
  }
  if (dispensary && !location) {
    actions.push(
      act(
        'dispensary-trend',
        `Longer view: 90-day price history for ${dispensary}.`,
        'price-history',
        clean({ dispensary, days: 90 }),
      ),
    );
  }
  return actions;
}
