import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

import { requireCrawlAuth } from '../src/lib/crawl-auth';

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalSecret === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = originalSecret;
});

function request(authHeader?: string): NextRequest {
  return new NextRequest('http://localhost/api/crawl', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

test('crawl auth returns 503 when CRON_SECRET is not configured', async () => {
  delete process.env.CRON_SECRET;
  const res = requireCrawlAuth(request('Bearer anything'));
  assert.ok(res);
  assert.equal(res.status, 503);
});

test('crawl auth rejects missing, malformed, and wrong tokens', () => {
  process.env.CRON_SECRET = 's3cret';
  // (Trailing whitespace isn't tested: the fetch-spec Headers class trims it
  // before the value ever reaches the auth check.)
  for (const header of [undefined, 's3cret', 'Bearer wrong', 'Bearer  s3cret', 'bearer s3cret']) {
    const res = requireCrawlAuth(request(header));
    assert.ok(res, `expected rejection for header: ${header}`);
    assert.equal(res.status, 401);
  }
});

test('crawl auth accepts the exact bearer token', () => {
  process.env.CRON_SECRET = 's3cret';
  assert.equal(requireCrawlAuth(request('Bearer s3cret')), null);
});
