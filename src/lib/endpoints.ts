export const RETIREMENT_MESSAGE =
  'Cannastack data endpoints are retired pending an authorized provider.';

export type EndpointSpec = {
  name: string;
  path: string;
  price_usdc: number;
};

// No data product is authorized or available for discovery.
export const ENDPOINTS: readonly EndpointSpec[] = [];

export function findEndpoint(name: string): EndpointSpec | undefined {
  return ENDPOINTS.find((endpoint) => endpoint.name === name);
}
