import { spawnSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
const isolated = { NODE_ENV: "test", KT_RUNTIME_ENV: "e2e", KT_NETWORK_DISABLED: "true", KT_E2E_PRIVATE_MEDIA_LOCAL: "true", PRIVATE_MEDIA_LOCAL_DIR: "/tmp/kt-couriers-e2e-private-media", DATABASE_URL: "postgresql://kt_phase75_e2e:disposable@db/kt_phase75_e2e" };
for (const [key, value] of [["NODE_ENV", "production"], ["KT_RUNTIME_ENV", "production"], ["KT_NETWORK_DISABLED", "false"], ["DATABASE_URL", "PRIVATE_DATABASE_DETAIL"], ["PRIVATE_MEDIA_LOCAL_DIR", "/app/public"]]) {
  test(`disposable launcher refuses unsafe ${key} before starting the server`, () => {
    const result = spawnSync(process.execPath, ["scripts/e2e-standalone-app.mjs"], { env: { ...process.env, ...isolated, [key]: value }, encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires the named network-isolated test environment/);
    assert.doesNotMatch(result.stdout + result.stderr, /PRIVATE_DATABASE_DETAIL/);
  });
}
