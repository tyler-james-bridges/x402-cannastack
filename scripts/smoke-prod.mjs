#!/usr/bin/env node
// smoke-prod.mjs -- run 5 demo queries against production and report status

const BASE = process.env.CANNASTACK_URL || 'https://cannastack.0x402.sh';

const QUERIES = [
  {
    name: 'strain-finder (Blue Dream / Phoenix)',
    endpoint: '/api/strain-finder',
    body: { strain: 'Blue Dream', location: 'Phoenix, AZ', radius: 15 },
    check: (d) => d.ok && d.dispensaries_searched > 0,
  },
  {
    name: 'price-compare (pre-rolls / Phoenix)',
    endpoint: '/api/price-compare',
    body: { category: 'pre-rolls', location: 'Phoenix', limit: 5 },
    check: (d) => d.ok && d.total_matches > 0,
  },
  {
    name: 'deal-scout (Las Vegas)',
    endpoint: '/api/deal-scout',
    body: { location: 'Las Vegas' },
    check: (d) => d.ok && d.total_dispensaries > 0,
  },
  {
    name: 'price-history (Gelato / 30d)',
    endpoint: '/api/price-history',
    body: { strain: 'Gelato', days: 30 },
    check: (d) => d.ok && Array.isArray(d.history),
  },
  {
    name: 'strain-finder (Wedding Cake / LA)',
    endpoint: '/api/strain-finder',
    body: { strain: 'Wedding Cake', location: 'Los Angeles', radius: 15 },
    check: (d) => d.ok && d.dispensaries_searched > 0,
  },
];

async function runQuery(q) {
  const url = `${BASE}${q.endpoint}`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(q.body),
    });
    const elapsed = Date.now() - start;
    const data = await res.json();
    const passed = res.ok && q.check(data);

    const resultCount =
      data.results?.length ??
      data.total_matches ??
      data.history?.length ??
      0;

    return {
      name: q.name,
      status: res.status,
      passed,
      elapsed,
      resultCount,
      source: data.source || 'n/a',
      summary: data.summary || '',
      error: data.error || null,
    };
  } catch (err) {
    return {
      name: q.name,
      status: 0,
      passed: false,
      elapsed: Date.now() - start,
      resultCount: 0,
      source: 'error',
      summary: '',
      error: err.message,
    };
  }
}

async function main() {
  console.log(`Smoke test: ${BASE}`);
  console.log(`Timestamp:  ${new Date().toISOString()}`);
  console.log('---');

  const results = [];
  for (const q of QUERIES) {
    const r = await runQuery(q);
    results.push(r);

    const icon = r.passed ? 'PASS' : 'FAIL';
    console.log(
      `[${icon}] ${r.name}  HTTP ${r.status}  ${r.elapsed}ms  ${r.resultCount} results  (${r.source})`,
    );
    if (r.error) console.log(`       error: ${r.error}`);
    if (r.summary) console.log(`       ${r.summary}`);
  }

  console.log('---');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(`${passed}/${total} passed`);

  if (passed < total) {
    process.exit(1);
  }
}

main();
