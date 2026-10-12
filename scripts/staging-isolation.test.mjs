import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { assertStagingIsolation } from "./staging-isolation.mjs";

function fixture() {
  const env = {
    KT_DATABASE_CLASSIFICATION: "staging", KT_RUNTIME_ENV: "staging-demo", KT_NETWORK_DISABLED: "true",
    EMAIL_PROVIDER: "console", PAYSTACK_ACTIVE: "false", PAYSTACK_MODE: "disabled", PAYFAST_MODE: "disabled", WITHDRAWAL_PAYOUT_ENABLED: "false",
    RAILWAY_PROJECT_ID: "synthetic-staging-project", RAILWAY_ENVIRONMENT_ID: "synthetic-staging-environment",
    DATABASE_URL: "postgresql://synthetic:synthetic_only@db.synthetic.invalid/kt_stage_test",
    REDIS_URL: "redis://synthetic:synthetic_only@redis.synthetic.invalid/1", KT_QUEUE_NAMESPACE: "synthetic-staging",
    NEXT_PUBLIC_APP_URL: "https://web.synthetic.invalid", PAYMENT_APP_ORIGIN: "https://web.synthetic.invalid", ALLOWED_ORIGINS: "https://web.synthetic.invalid",
    PRIVATE_MEDIA_STORAGE: "local", CATALOG_MEDIA_STORAGE: "filesystem", REPORT_ARTIFACT_STORAGE: "local", KT_STAGING_WORKER_COMMAND: "synthetic-offline-worker",
  };
  const policy = {
    approval: { owner: "synthetic-test-only", evidenceRef: "synthetic-test-only", currency: "ZAR", maxSpend: 0, expiresAt: "2999-01-01T00:00:00Z" },
    protectedInventoryRef: "synthetic-test-only", protectedSecretFingerprints: [], protectedResourceIds: ["synthetic-protected-project"],
    railwayProjectId: env.RAILWAY_PROJECT_ID, railwayEnvironmentId: env.RAILWAY_ENVIRONMENT_ID,
    workerCommands: [env.KT_STAGING_WORKER_COMMAND], allowedHosts: ["db.synthetic.invalid", "redis.synthetic.invalid", "web.synthetic.invalid"],
    databaseName: "kt_stage_test", redisDatabase: 1, queueNamespace: env.KT_QUEUE_NAMESPACE, storageResources: [],
    secretFingerprints: Object.fromEntries(["DATABASE_URL", "REDIS_URL"].map(name => [name, createHash("sha256").update(env[name]).digest("hex")])),
  };
  return { env, policy };
}
test("explicit isolated offline synthetic resources pass and expose names only", () => {
  const { env, policy } = fixture(); const result = assertStagingIsolation(env, policy);
  assert.equal(result.status, "PASS"); assert.equal(result.providerMode, "offline");
  assert.ok(!JSON.stringify(result).includes("synthetic_only"));
});
test("production-marked origins, database, bucket, credentials and identities fail", () => {
  for (const extra of [
    { NEXT_PUBLIC_APP_URL: "https://www.ktcouriers.com" }, { PAYMENT_APP_ORIGIN: "https://web-production-9f8bb.up.railway.app" },
    { DATABASE_URL: "postgresql://synthetic:synthetic_only@db.synthetic.invalid/kt_production" },
    { REDIS_URL: "redis://synthetic:synthetic_only@redis.production.invalid/1" }, { COOKIE_DOMAIN: ".ktcouriers.com" },
    { PAYSTACK_SECRET_KEY: "sk_live_synthetic_only" }, { CLOUDINARY_API_SECRET: "synthetic" }, { PRIVATE_MEDIA_S3_BUCKET: "production-private" },
    { RAILWAY_PROJECT_ID: "synthetic-protected-project" }, { KT_QUEUE_NAMESPACE: "production" }, { EMAIL_PROVIDER: "resend" },
    { KT_NETWORK_DISABLED: "false" }, { KT_STAGING_WORKER_COMMAND: "unreviewed-worker" }, { PRIVATE_MEDIA_STORAGE: "s3" },
  ]) { const { env, policy } = fixture(); assert.throws(() => assertStagingIsolation({ ...env, ...extra }, policy), /REFUSED/); }
});
test("fingerprint reuse is denied without displaying values", () => {
  const { env, policy } = fixture(); policy.protectedSecretFingerprints.push(policy.secretFingerprints.DATABASE_URL);
  assert.throws(() => assertStagingIsolation(env, policy), error => error.message.includes("DATABASE_URL") && !error.message.includes("synthetic_only"));
});
test("unknown secret and egress endpoints cannot be inherited", () => {
  for (const extra of [{ INTERNAL_JOB_SECRET: "synthetic_unregistered" }, { NEXT_PUBLIC_API_URL: "https://unknown.invalid" }, { SHADOW_DATABASE_URL: "postgresql://synthetic:synthetic_only@db.synthetic.invalid/unregistered" }, { ALLOWED_ORIGINS: "https://web.synthetic.invalid,https://www.ktcouriers.com" }]) {
    const { env, policy } = fixture(); assert.throws(() => assertStagingIsolation({ ...env, ...extra }, policy), /REFUSED/);
  }
});
test("missing, expired or incomplete authority cannot claim staging acceptance", () => {
  for (const mutate of [p => { delete p.approval; }, p => { p.approval.expiresAt = "2000-01-01"; }, p => { delete p.protectedInventoryRef; }, p => { p.approval.maxSpend = -1; }, p => { p.allowedHosts = []; }]) {
    const { env, policy } = fixture(); mutate(policy); assert.throws(() => assertStagingIsolation(env, policy), /REFUSED/);
  }
});
