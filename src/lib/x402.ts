import { withX402, x402ResourceServer } from '@x402/next';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { Network } from '@x402/core/types';
import { NextRequest, NextResponse } from 'next/server';

// cannastack settles on Abstract in USDC. Mirrors the proven etch x402 pattern
// and uses the same facilitator (which supports Abstract, not Base).
export const ABSTRACT_NETWORK: Network = 'eip155:2741';

export const ABSTRACT_FACILITATOR_URL =
  process.env.X402_FACILITATOR_ABSTRACT || 'https://facilitator.x402.abs.xyz';

// Bridged USDC (Stargate) on Abstract.
export const ABSTRACT_USDC = '0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1';
export const USDC_DECIMALS = 6;

// Wallet that receives per-request payments. Override via env in prod.
const DEFAULT_PAY_TO = (
  process.env.CANNASTACK_PAY_TO ||
  process.env.ETCH_MINTER_ADDRESS ||
  '0x668aDd9213985E7Fd613Aec87767C892f4b9dF1c'
).trim();

// Free-preview master switch. When true, all gating is bypassed (legacy preview).
// Default: metering ON. Set X402_PREVIEW_MODE=1 to serve everything free.
export const PREVIEW_MODE =
  process.env.X402_PREVIEW_MODE === '1' || process.env.X402_PREVIEW_MODE === 'true';

if (PREVIEW_MODE) {
  console.warn(
    '[x402] X402_PREVIEW_MODE is on — all paid endpoints are served FREE. Unset it to restore metering.',
  );
}

let _abstractServer: x402ResourceServer | null = null;

function makeScheme() {
  const scheme = new ExactEvmScheme();
  scheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === ABSTRACT_NETWORK) {
      return {
        amount: Math.round(amount * 1e6).toString(),
        asset: ABSTRACT_USDC,
        extra: {
          name: 'Bridged USDC (Stargate)',
          version: '2',
          decimals: USDC_DECIMALS,
        },
      };
    }
    return null;
  });
  return scheme;
}

function getAbstractServer(): x402ResourceServer {
  if (!_abstractServer) {
    _abstractServer = new x402ResourceServer(
      new HTTPFacilitatorClient({ url: ABSTRACT_FACILITATOR_URL }),
    ).register(ABSTRACT_NETWORK, makeScheme());
  }
  return _abstractServer;
}

/**
 * Wrap a POST handler with x402 payment enforcement on Abstract USDC.
 * When PREVIEW_MODE is on, the handler is returned unwrapped (free).
 */
export function withPayment(
  handler: (request: NextRequest) => Promise<NextResponse>,
  price: string,
  description: string,
  payTo?: string,
) {
  if (PREVIEW_MODE) {
    return handler;
  }

  return withX402(
    handler,
    {
      accepts: [
        {
          scheme: 'exact',
          payTo: payTo || DEFAULT_PAY_TO,
          price,
          network: ABSTRACT_NETWORK,
        },
      ],
      description,
      mimeType: 'application/json',
    },
    getAbstractServer(),
  );
}
