/**
 * Repeatable Phase 2 *isolated* HTTP capacity smoke: never direct it at production.
 * This establishes a reproducible synthetic operating baseline, NOT a live SLA.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

const SCENARIOS = Object.freeze([
  { path: '/api/health', label: 'health', maxP95Ms: 2500 },
  { path: '/api/ready', label: 'readiness', maxP95Ms: 2500 },
  { path: '/quote', label: 'anonymous-quote', maxP95Ms: 6000 },
  { path: '/shop', label: 'public-marketplace', maxP95Ms: 6000 },
]);
const REQUESTS = 80;
const CONCURRENCY = 4;
const TIMEOUT_MS = 12000;

export function assertIsolatedTarget(value, env = process.env) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Capacity target must be an explicit HTTP localhost origin.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !url.port || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error('Refusing a non-loopback or non-origin capacity target.');
  }
  if (env.KT_RUNTIME_ENV !== 'e2e' || env.KT_NETWORK_DISABLED !== 'true' || env.PAYSTACK_MODE !== 'test' || env.EMAIL_PROVIDER !== 'console') {
    throw new Error('Capacity measurement requires isolated E2E runtime, blocked provider network, test payments and console mail.');
  }
  return url.origin;
}

export function percentile(samples, percentage) {
  if (!samples.length || !Number.isFinite(percentage) || percentage < 0 || percentage > 100) throw new Error('Invalid latency percentile.');
  const sorted = [...samples].sort((a,b) => a-b);
  return sorted[Math.max(0, Math.ceil(sorted.length * percentage / 100) - 1)];
}

function boundedPositiveInteger(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}.`);
}

export async function executeBoundedScenario({ baseUrl, path, requests, concurrency, timeoutMs }) {
  boundedPositiveInteger(requests, 1, 250, 'requests');
  boundedPositiveInteger(concurrency, 1, 10, 'concurrency');
  boundedPositiveInteger(timeoutMs, 500, 20000, 'timeoutMs');
  if (!/^\/[a-z0-9/-]+$/i.test(path)) throw new Error('Read-only route path required.');
  const url = new URL(path, baseUrl);
  if (url.origin !== new URL(baseUrl).origin) throw new Error('Cross-origin load targets are forbidden.');
  let assigned = 0;
  let succeeded = 0;
  let failed = 0;
  const statusCounts = {};
  const latenciesMs = [];
  const startedAt = performance.now();
  async function worker() {
    while (assigned < requests) {
      assigned++;
      const start = performance.now();
      try {
        const response = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(timeoutMs), redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
        // Consume the response so latencies include full (bounded) transfer.
        await response.arrayBuffer();
        const code = String(response.status);
        statusCounts[code] = (statusCounts[code] ?? 0) + 1;
        if (response.status === 200) succeeded++;
        else failed++;
      } catch {
        statusCounts.networkError = (statusCounts.networkError ?? 0) + 1;
        failed++;
      } finally { latenciesMs.push(performance.now() - start); }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  const elapsedMs = performance.now() - startedAt;
  return {
    path, requests, concurrency, succeeded, failed, statusCounts,
    elapsedMs: Math.round(elapsedMs), throughputRps: Number((1000 * requests / elapsedMs).toFixed(2)),
    p50Ms: Math.round(percentile(latenciesMs, 50)), p95Ms: Math.round(percentile(latenciesMs, 95)),
    p99Ms: Math.round(percentile(latenciesMs, 99)), maxMs: Math.round(Math.max(...latenciesMs)), latenciesMs,
  };
}

export function evaluateCapacityResult(result, { maxP95Ms, maxErrorRate }) {
  const errorRate = result.failed / result.requests;
  return { pass: errorRate <= maxErrorRate && result.p95Ms <= maxP95Ms, errorRate, maxP95Ms, maxErrorRate };
}

export async function main(value = process.argv[2], env = process.env) {
  const baseUrl = assertIsolatedTarget(value, env);
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('An exact commit SHA is required.');
  const start = new Date().toISOString();
  const results = [];
  for (const scenario of SCENARIOS) {
    // Warmups are recorded separately and cannot mask actual sample failures.
    const warmup = await executeBoundedScenario({ baseUrl, path: scenario.path, requests: 4, concurrency: 1, timeoutMs: TIMEOUT_MS });
    if (warmup.failed) throw new Error(`Warmup failed for ${scenario.path}; refusing ambiguous capacity results.`);
    const measured = await executeBoundedScenario({ baseUrl, path: scenario.path, requests: REQUESTS, concurrency: CONCURRENCY, timeoutMs: TIMEOUT_MS });
    const outcome = evaluateCapacityResult(measured, { maxP95Ms: scenario.maxP95Ms, maxErrorRate: 0 });
    results.push({ name: scenario.label, ...measured, latenciesMs: undefined, warmupRequests: warmup.requests, ...outcome });
    console.log(`PHASE2_CAPACITY ${scenario.label}: ${measured.succeeded}/${REQUESTS} successful; p95 ${measured.p95Ms}ms (provisional limit ${scenario.maxP95Ms}ms), ${measured.throughputRps} req/s: ${outcome.pass ? 'PASS' : 'FAIL'}`);
  }
  const pass = results.length === SCENARIOS.length && results.every(item => item.pass);
  const receipt = {
    schemaVersion: 1, sourceSha: sha, startedAt: start, endedAt: new Date().toISOString(),
    status: pass ? 'PASS' : 'FAIL', evidenceTier: 'T2_DISPOSABLE_HTTP',
    scope: 'isolated local HTTP smoke; not production load, not a committed live SLA',
    target: 'loopback:disposable-e2e-app', concurrency: CONCURRENCY, requestsPerRoute: REQUESTS,
    thresholdAuthority: 'provisional engineering smoke targets; production SLA must be approved separately',
    results,
  };
  const output = 'output/production-closure/phase2-bounded-capacity.json';
  mkdirSync('output/production-closure', { recursive: true });
  writeFileSync(output, JSON.stringify(receipt, null, 2));
  console.log(`PHASE2_CAPACITY_RECEIPT=${output} SOURCE_SHA=${sha} STATUS=${receipt.status}`);
  if (!pass) process.exitCode = 1;
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
