import { NextRequest, NextResponse } from 'next/server';

import { apiHeaders, menuPreflight } from '@/lib/api-response';
import { findEndpoint } from '@/lib/endpoints';
import {
  MENU_LIMITS,
  validateMenuRequest,
  type MenuOperation,
  type ParsedMenuRequest,
} from '@/lib/menu-contract';
import { processMenuRequest } from '@/lib/menu';
import { withPayment } from '@/lib/x402';

const MENU_METHODS = 'POST, OPTIONS';

type RequestFailure = {
  status: 400 | 403 | 413 | 415 | 422;
  code: string;
  issues?: { code: string; path: string }[];
};

export type ParsedRequestResult =
  | { success: true; data: ParsedMenuRequest }
  | { success: false; error: RequestFailure };

function failure(
  status: RequestFailure['status'],
  code: string,
  issueCode?: string,
  path = '',
): ParsedRequestResult {
  return {
    success: false,
    error: {
      status,
      code,
      ...(issueCode ? { issues: [{ code: issueCode, path }] } : {}),
    },
  };
}

function supportsJson(contentType: string | null): boolean {
  if (!contentType) return false;
  const parts = contentType.split(';').map((part) => part.trim().toLowerCase());
  if (parts[0] !== 'application/json') return false;
  return parts
    .slice(1)
    .every((part) => part === 'charset=utf-8' || part === 'charset="utf-8"');
}

async function cappedBody(request: NextRequest): Promise<Uint8Array | RequestFailure> {
  const declaredLength = request.headers.get('content-length');
  let expectedLength: number | null = null;
  if (declaredLength !== null) {
    if (!/^\d+$/u.test(declaredLength)) {
      return { status: 400, code: 'invalid_content_length' };
    }
    const length = BigInt(declaredLength);
    if (length > BigInt(MENU_LIMITS.bodyBytes)) {
      return { status: 413, code: 'body_too_large' };
    }
    expectedLength = Number(length);
  }

  if (!request.body) return { status: 400, code: 'empty_body' };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MENU_LIMITS.bodyBytes) {
        void reader.cancel().catch(() => undefined);
        return { status: 413, code: 'body_too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { status: 400, code: 'invalid_body' };
  }

  if (expectedLength !== null && expectedLength !== length) {
    return { status: 400, code: 'invalid_content_length' };
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function parseMenuRequest(
  request: NextRequest,
  operation: MenuOperation,
): Promise<ParsedRequestResult> {
  if (!supportsJson(request.headers.get('content-type'))) {
    return failure(415, 'unsupported_content_type');
  }
  const encoding = request.headers.get('content-encoding')?.trim().toLowerCase();
  if (encoding && encoding !== 'identity') {
    return failure(415, 'unsupported_content_encoding');
  }

  const body = await cappedBody(request);
  if (!(body instanceof Uint8Array)) return { success: false, error: body };
  if (body.byteLength === 0) return failure(400, 'empty_body');

  let input: unknown;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(body);
    if (text.trim().length === 0) return failure(400, 'empty_body');
    input = JSON.parse(text);
  } catch {
    return failure(400, 'malformed_json');
  }

  const validation = validateMenuRequest(operation, input);
  if (!validation.success) return { success: false, error: validation.error };
  return { success: true, data: validation.data };
}

function errorResponse(error: RequestFailure): NextResponse {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        ...(error.issues ? { issues: error.issues } : {}),
      },
    },
    { status: error.status, headers: apiHeaders(MENU_METHODS) },
  );
}

export function createMenuRoute(operation: MenuOperation) {
  const endpoint = findEndpoint(`menu-${operation}`);
  if (!endpoint) throw new Error('Menu endpoint configuration is missing.');
  const validatedRequests = new WeakMap<NextRequest, ParsedMenuRequest>();

  const paidHandler = withPayment(
    async (request) => {
      const parsed = validatedRequests.get(request);
      if (!parsed) return errorResponse({ status: 400, code: 'invalid_body' });
      try {
        return NextResponse.json(processMenuRequest(operation, parsed), {
          status: 200,
          headers: apiHeaders(MENU_METHODS),
        });
      } catch {
        return NextResponse.json(
          { ok: false, error: { code: 'processing_failed' } },
          { status: 500, headers: apiHeaders(MENU_METHODS) },
        );
      }
    },
    endpoint.price,
    endpoint.summary,
  );

  return {
    POST: async (request: NextRequest) => {
      const parsed = await parseMenuRequest(request, operation);
      if (!parsed.success) return errorResponse(parsed.error);
      validatedRequests.set(request, parsed.data);
      try {
        return await paidHandler(request);
      } finally {
        validatedRequests.delete(request);
      }
    },
    OPTIONS: menuPreflight,
  };
}
