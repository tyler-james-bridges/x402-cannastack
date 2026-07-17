# Cannastack

Cannastack's public cannabis data service is retired pending an authorized provider.

## Current state

- Active paid data endpoints: 0
- Legacy data routes: HTTP 410 Gone
- x402 challenges on retired routes: disabled
- Third-party menu, listing, and price data: unavailable

The public discovery surfaces all report this same inactive state:

- `/openapi.json` contains an empty `paths` object.
- `/.well-known/x402.json` contains an empty `endpoints` array.
- `/llms.txt` describes the retirement state without request examples.

Generic x402 payment infrastructure remains in the repository. It is not attached to a discoverable paid resource.

## Development

```bash
npm install
npm run dev
```

Use `npm run typecheck`, `npm test`, and `npm run test:e2e` for verification.

## License

MIT
