#!/usr/bin/env node

// Production preflight checks for CannaStack
// Verifies all public URLs return 200 and reports response times.

const BASE = 'https://cannastack.0x402.sh';

const URLS = [
  '/',
  '/docs',
  '/status',
  '/api/analytics',
  '/api/crawl/status',
  '/openapi.json',
  '/llms.txt',
  '/.well-known/x402.json',
];

async function check(path) {
  const url = `${BASE}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: 'follow' });
    const ms = Math.round(performance.now() - start);
    return { url, status: res.status, ms, ok: res.status === 200 };
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    return { url, status: 0, ms, ok: false, error: err.message };
  }
}

async function main() {
  console.log(`Preflight check: ${BASE}\n`);

  const results = await Promise.all(URLS.map(check));
  let failed = 0;

  for (const r of results) {
    const icon = r.ok ? 'PASS' : 'FAIL';
    const line = `[${icon}] ${r.status} ${r.url} (${r.ms}ms)`;
    if (r.error) {
      console.log(`${line} - ${r.error}`);
    } else {
      console.log(line);
    }
    if (!r.ok) failed++;
  }

  console.log(`\n${results.length - failed}/${results.length} passed`);

  if (failed > 0) {
    console.error(`\n${failed} endpoint(s) failed preflight.`);
    process.exit(1);
  }
}

main();
