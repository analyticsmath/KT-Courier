import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const gateway = new URL('../edge-gateway/vercel.json', import.meta.url);
const canonicalRouting = readFileSync(new URL('../lib/deployment/edge-routing.ts', import.meta.url), 'utf8');

test('static edge preserves the approved Railway production origin and all paths', () => {
  const configuration = JSON.parse(readFileSync(gateway, 'utf8'));
  assert.deepEqual(configuration.rewrites, [{
    source: '/:path*',
    destination: 'https://web-production-9f8bb.up.railway.app/:path*',
  }]);
  assert.match(canonicalRouting, /PRODUCTION_EDGE_ORIGIN = "https:\/\/web-production-9f8bb\.up\.railway\.app"/);
  assert.ok(!configuration.functions && !configuration.crons, 'Static gateway must not create functions or schedule jobs');
});

test('gateway health asset exists for static build verification', () => {
  const status = readFileSync(new URL('../edge-gateway/public/edge-gateway-health.txt', import.meta.url), 'utf8');
  assert.equal(status.trim(), 'KT Couriers edge gateway is configured.');
});
