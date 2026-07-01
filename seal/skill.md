# Strain Run

Tell Seal a strain, product category, or cannabis vibe plus a location, and return one JSON card with the cheapest nearby dispensaries, prices, distance, and active deal flags.

Author: Tyler (tmoney_145) / cannastack
Price: $0.05 per Seal call. Uses cannastack's live $0.02 x402 data endpoints.

## Call Contract

Route the user's natural-language ask with `routeStrainRunAsk`, call the returned cannastack endpoint, then render the response through `formatStrainRunCard`.

Live endpoints:

- `POST https://cannastack.0x402.sh/api/strain-finder`
- `POST https://cannastack.0x402.sh/api/deal-scout`
- `POST https://cannastack.0x402.sh/api/price-compare`

## Examples

- "find Blue Dream near Denver under $30"
- "best edibles deal in Tempe tonight"
- "cheapest pre-rolls in Phoenix"
- "something for sleep near Scottsdale"

## Card Contract

Returns pure JSON with `ok`, `type`, `title`, `header`, `rows`, `summary`, and `footer`. Each row includes `dispensary`, optional `item`, optional `price`, optional `distance_mi`, `active_deal`, and optional `url`.

Bad input, no results, or endpoint errors must still return the same card shape with an empty `rows` array and a friendly `summary`.
