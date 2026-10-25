import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { assertIsolatedTarget, percentile, executeBoundedScenario, evaluateCapacityResult } from '../../scripts/phase2-bounded-capacity.mjs';

const isolatedEnv = { KT_RUNTIME_ENV: 'e2e', KT_NETWORK_DISABLED: 'true', PAYSTACK_MODE: 'test', EMAIL_PROVIDER: 'console' };

test('capacity audit refuses public and provider-connected runtime', () => {
  for (const target of ['https://www.ktcouriers.com', 'http://192.168.1.2:3000', 'http://127.0.0.1.evil.tld:3000', 'http://user:pass@127.0.0.1:3000', 'http://localhost:3000/foo']) {
    assert.throws(() => assertIsolatedTarget(target, isolatedEnv));
  }
  assert.throws(() => assertIsolatedTarget('http://127.0.0.1:3000', { ...isolatedEnv, KT_NETWORK_DISABLED: 'false' }));
  assert.throws(() => assertIsolatedTarget('http://127.0.0.1:3000', { ...isolatedEnv, KT_RUNTIME_ENV: 'production' }));
  assert.doesNotThrow(() => assertIsolatedTarget('http://127.0.0.1:3000', isolatedEnv));
});

test('percentile is nearest-rank and rejects empty results', () => {
  assert.equal(percentile([40, 10, 30, 20], 95), 40);
  assert.equal(percentile([40, 10, 30, 20], 50), 20);
  assert.throws(() => percentile([], 95));
});

test('bounded isolated GET load records exact counts, failures and latency', async () => {
  let active = 0;
  let observedPeak = 0;
  let hits = 0;
  const server = createServer((req, res) => {
    active++;
    observedPeak = Math.max(active, observedPeak);
    hits++;
    setTimeout(() => {
      if (req.url === '/bad') { res.writeHead(503); res.end('unavailable'); }
      else { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('ok'); }
      active--;
    }, 4);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const ok = await executeBoundedScenario({ baseUrl: base, path: '/ok', requests: 24, concurrency: 3, timeoutMs: 2000 });
    assert.equal(ok.requests, 24);
    assert.equal(ok.succeeded, 24);
    assert.equal(ok.failed, 0);
    assert.equal(ok.latenciesMs.length, 24);
    assert.ok(ok.p95Ms > 0 && ok.maxMs >= ok.p95Ms);
    assert.ok(observedPeak <= 3);
    assert.equal(hits, 24);
    assert.equal(evaluateCapacityResult(ok, { maxP95Ms: 2000, maxErrorRate: 0 }).pass, true);
    const bad = await executeBoundedScenario({ baseUrl: base, path: '/bad', requests: 4, concurrency: 2, timeoutMs: 2000 });
    assert.equal(bad.failed, 4);
    assert.equal(evaluateCapacityResult(bad, { maxP95Ms: 2000, maxErrorRate: 0 }).pass, false);
  } finally { await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
