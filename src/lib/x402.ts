import { withX402, x402ResourceServer } from '@x402/next';
import { FacilitatorResponseError, type FacilitatorClient } from '@x402/core/server';
import { decodePaymentRequiredHeader } from '@x402/core/http';
import {
  type SettleResponse,
  type SupportedResponse,
  type VerifyResponse,
} from '@x402/core/types';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import {
  BUILDER_CODE,
  builderCodeResourceServerExtension,
  declareBuilderCodeExtension,
} from '@x402/extensions/builder-code';
import type { Network } from '@x402/core/types';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiHeaders, mergeApiHeaders } from '@/lib/api-response';

// Paid menu resources settle in native USDC on Base.
export const BASE_NETWORK: Network = 'eip155:8453';
export const BASE_BUILDER_CODE = 'bc_jhxtiha3' as const;

export const ACTIVE_CHAIN = 'base' as const;
export const ACTIVE_NETWORK: Network = BASE_NETWORK;

// The facilitator must advertise exact payments on Base mainnet.
export const BASE_FACILITATOR_URL =
  (process.env.X402_FACILITATOR_BASE || 'https://facilitator.payai.network').replace(/\/+$/u, '');

export const ACTIVE_FACILITATOR_URL = BASE_FACILITATOR_URL;

// Native USDC on Base (Circle, "USD Coin").
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_DECIMALS = 6;
const FACILITATOR_TIMEOUT_MS = 10_000;
const MENU_METHODS = 'POST, OPTIONS';

function previewModeEnabled(): boolean {
  const requested =
    process.env.X402_PREVIEW_MODE === '1' || process.env.X402_PREVIEW_MODE === 'true';
  return requested && process.env.NODE_ENV !== 'production';
}

export const PREVIEW_MODE = previewModeEnabled();

function makeScheme() {
  const scheme = new ExactEvmScheme();
  scheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === BASE_NETWORK) {
      return {
        amount: Math.round(amount * 1e6).toString(),
        asset: BASE_USDC,
        extra: {
          name: 'USD Coin',
          version: '2',
          decimals: USDC_DECIMALS,
        },
      };
    }
    return null;
  });
  return scheme;
}

const supportedSchema = z.object({
  kinds: z.array(z.object({
    x402Version: z.number(),
    scheme: z.string(),
    network: z.custom<Network>((value) => typeof value === 'string'),
    extra: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
  })),
  extensions: z.array(z.string()).default([]),
  signers: z.record(z.string(), z.array(z.string())).default({}),
});

const verifySchema = z.object({
  isValid: z.boolean(),
  invalidReason: z.string().nullish().transform((value) => value ?? undefined),
  invalidMessage: z.string().nullish().transform((value) => value ?? undefined),
  payer: z.string().nullish().transform((value) => value ?? undefined),
  extensions: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
  extra: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
});

const settleSchema = z.object({
  success: z.boolean(),
  errorReason: z.string().nullish().transform((value) => value ?? undefined),
  errorMessage: z.string().nullish().transform((value) => value ?? undefined),
  payer: z.string().nullish().transform((value) => value ?? undefined),
  transaction: z.string(),
  network: z.custom<Network>((value) => typeof value === 'string'),
  amount: z.string().nullish().transform((value) => value ?? undefined),
  extensions: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
  extra: z.record(z.string(), z.unknown()).nullish().transform((value) => value ?? undefined),
});

function jsonBody(value: unknown): string {
  return JSON.stringify(value, (_, item) =>
    typeof item === 'bigint' ? item.toString() : item,
  );
}

async function facilitatorRequest(
  path: 'supported' | 'verify' | 'settle',
  body?: unknown,
): Promise<{ response: Response; data: unknown }> {
  let response: Response;
  try {
    response = await fetch(`${ACTIVE_FACILITATOR_URL}/${path}`, {
      ...(body === undefined ? {} : { method: 'POST', body: jsonBody(body) }),
      headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      signal: AbortSignal.timeout(FACILITATOR_TIMEOUT_MS),
    });
  } catch {
    throw new FacilitatorResponseError(`Facilitator ${path} request failed.`);
  }
  let data: unknown;
  try {
    data = JSON.parse(await response.text());
  } catch {
    throw new FacilitatorResponseError(`Facilitator ${path} response was invalid.`);
  }
  return { response, data };
}

function parseFacilitatorResponse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  operation: string,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new FacilitatorResponseError(`Facilitator ${operation} response was invalid.`);
  }
  return result.data;
}

function createFacilitator(): FacilitatorClient {
  return {
    async getSupported(): Promise<SupportedResponse> {
      const { response, data } = await facilitatorRequest('supported');
      if (!response.ok) {
        throw new FacilitatorResponseError('Facilitator supported request failed.');
      }
      return parseFacilitatorResponse(supportedSchema, data, 'supported');
    },
    async verify(payload, requirements): Promise<VerifyResponse> {
      const { response, data } = await facilitatorRequest('verify', {
        x402Version: payload.x402Version,
        paymentPayload: payload,
        paymentRequirements: requirements,
      });
      const result = parseFacilitatorResponse(verifySchema, data, 'verify');
      if (!response.ok) {
        if (response.status >= 500 || response.status === 408 || response.status === 429) {
          throw new FacilitatorResponseError('Facilitator verify request failed.');
        }
        return {
          ...result,
          isValid: false,
          invalidReason: result.invalidReason ?? 'payment_verification_rejected',
        };
      }
      return result;
    },
    async settle(payload, requirements): Promise<SettleResponse> {
      try {
        const { response, data } = await facilitatorRequest('settle', {
          x402Version: payload.x402Version,
          paymentPayload: payload,
          paymentRequirements: requirements,
        });
        const result = parseFacilitatorResponse(settleSchema, data, 'settle');
        if (!response.ok) {
          return {
            ...result,
            success: false,
            errorReason: result.errorReason ?? 'settlement_rejected',
          };
        }
        return result;
      } catch (error) {
        if (!(error instanceof FacilitatorResponseError)) throw error;
        return {
          success: false,
          errorReason: 'settlement_indeterminate',
          errorMessage: 'Settlement outcome could not be confirmed.',
          transaction: '',
          network: requirements.network,
        };
      }
    },
  };
}

function createServer(): x402ResourceServer {
  const client = createFacilitator();
  return new x402ResourceServer(client)
    .register(ACTIVE_NETWORK, makeScheme())
    .registerExtension(builderCodeResourceServerExtension);
}

/**
 * Mirror the v2 PAYMENT-REQUIRED header into the JSON response body.
 *
 * The x402 SDK treats the header as canonical and otherwise emits `{}` for API
 * clients. Some agent clients discover payment requirements from the 402 body,
 * so returning both representations keeps those clients interoperable while
 * preserving the standard header for SDK-based clients.
 */
function paymentErrorResponse(response: NextResponse, code: string): NextResponse {
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('payment-required');
  return mergeApiHeaders(
    NextResponse.json({ ok: false, error: { code } }, { status: 502, headers }),
    MENU_METHODS,
  );
}

export function withPaymentRequiredBody(response: NextResponse): NextResponse {
  if (response.status === 502) return paymentErrorResponse(response, 'payment_service_unavailable');
  if (response.status !== 402) return mergeApiHeaders(response, MENU_METHODS);

  const encodedChallenge = response.headers.get('payment-required');
  if (!encodedChallenge) return paymentErrorResponse(response, 'payment_settlement_indeterminate');

  try {
    const headers = new Headers(response.headers);
    headers.delete('content-length');

    return mergeApiHeaders(
      NextResponse.json(decodePaymentRequiredHeader(encodedChallenge), {
        status: response.status,
        statusText: response.statusText,
        headers,
      }),
      MENU_METHODS,
    );
  } catch {
    return paymentErrorResponse(response, 'payment_challenge_invalid');
  }
}

/**
 * Wrap a POST handler with lazy x402 payment enforcement on Base.
 */
export function withPayment(
  handler: (request: NextRequest) => Promise<NextResponse>,
  price: string,
  description: string,
) {
  let paymentHandler: ReturnType<typeof withX402> | null = null;
  let paymentRecipient = '';

  return async (request: NextRequest): Promise<NextResponse> => {
    if (previewModeEnabled()) return mergeApiHeaders(await handler(request), MENU_METHODS);

    const payTo = process.env.CANNASTACK_PAY_TO?.trim() ?? '';
    if (!/^0x[0-9a-fA-F]{40}$/u.test(payTo) || /^0x0{40}$/u.test(payTo)) {
      return NextResponse.json(
        { ok: false, error: { code: 'payment_configuration_unavailable' } },
        { status: 503, headers: apiHeaders(MENU_METHODS) },
      );
    }

    try {
      if (!paymentHandler || paymentRecipient !== payTo) {
        paymentHandler = withX402(
          handler,
          {
            accepts: [{ scheme: 'exact', payTo, price, network: BASE_NETWORK }],
            description,
            mimeType: 'application/json',
            extensions: {
              [BUILDER_CODE]: declareBuilderCodeExtension(BASE_BUILDER_CODE),
            },
          },
          createServer(),
        );
        paymentRecipient = payTo;
      }
      return withPaymentRequiredBody(await paymentHandler(request));
    } catch {
      return NextResponse.json(
        { ok: false, error: { code: 'payment_service_unavailable' } },
        { status: 502, headers: apiHeaders(MENU_METHODS) },
      );
    }
  };
}
