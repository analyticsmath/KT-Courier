import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("Next 16 loader refuses production-project previews before compiling or connecting", () => {
  const result = spawnSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], {
    encoding: "utf8", timeout: 30_000,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", VERCEL: "1", VERCEL_ENV: "preview", VERCEL_PROJECT_ID: "prj_Q6i3g8JIv1ibkXGspPotBem2FFLD", KT_EDGE_ROLE: "production", KT_NETWORK_DISABLED: "true", DATABASE_URL: "postgresql://synthetic:synthetic@127.0.0.1:1/kt_unreachable" },
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout + result.stderr, /EDGE_ISOLATION: nonproduction deployment is not registered/);
  assert.doesNotMatch(result.stdout + result.stderr, /Compiled successfully|Generating static pages/);
});
