export const DEFAULT_PLAYWRIGHT_TIMEOUT_MS = 15 * 60 * 1000;
export const PHASE1_FULL_CHROMIUM_TIMEOUT_MS = 45 * 60 * 1000;
export const PHASE2_3_DIRECTED_TIMEOUT_MS = 45 * 60 * 1000;
export const PHASE2_3_DIRECTED_EXPECTED_TESTS = 47;

export const PHASE2_3_DIRECTED_SPECS = Object.freeze([
  "tests/e2e/customer-wallet-refunds.spec.ts",
  "tests/e2e/refund-finance-admin.spec.ts",
  "tests/e2e/store-order-customer.spec.ts",
  "tests/e2e/store-order-merchant.spec.ts",
  "tests/e2e/store-order-admin.spec.ts",
  "tests/e2e/store-order-substitution.spec.ts",
  "tests/e2e/store-order-handoff.spec.ts",
  "tests/e2e/store-order-accessibility.spec.ts",
  "tests/e2e/profile-avatar-lifecycle.spec.ts",
  "tests/e2e/transactional-notifications.spec.ts",
  "tests/e2e/trusted-parcel-classification.spec.ts",
  "tests/e2e/driver-canonical-delivery.spec.ts",
  "tests/e2e/cod-custody-remittance.spec.ts",
  "tests/e2e/catalog-inventory-upload.spec.ts",
  "tests/e2e/catalog-product-import.spec.ts",
  "tests/e2e/anonymous-courier-quote.spec.ts",
  "tests/e2e/customer-identity-lifecycle.spec.ts",
  "tests/e2e/store-order-positive-substitution.spec.ts",
  "tests/e2e/store-branding-lifecycle.spec.ts",
]);

export function e2eImageNames(runId) {
  if (typeof runId !== "string" || !/^[a-z0-9][a-z0-9_.-]{0,63}$/.test(runId)) {
    throw new Error("E2E image run id must be a lowercase Docker-tag-safe value.");
  }

  return {
    appImage: `kt-couriers-e2e-app:${runId}`,
    migrateImage: `kt-couriers-e2e-migrate:${runId}`,
  };
}

export function disposableProviderEnvironment(env = {}) {
  return {
    ...env,
    PAYSTACK_SECRET_KEY: "sk_test_disposable_browser_no_provider",
    PAYSTACK_PUBLIC_KEY: "pk_test_disposable_browser_no_provider",
    PAYFAST_MERCHANT_ID: "",
    PAYFAST_MERCHANT_KEY: "",
    PAYFAST_PASSPHRASE: "",
    RESEND_API_KEY: "",
  };
}

export function e2eStandaloneRuntimeDockerfile(migrationImage, sourceSha) {
  if (!/^kt-couriers-e2e-migrate:[a-z0-9][a-z0-9_.-]{0,63}$/.test(migrationImage ?? "")) {
    throw new Error("Host standalone runtime requires a run-scoped disposable migration image.");
  }
  if (typeof sourceSha !== "string" || !/^[a-f0-9]{40}$/.test(sourceSha)) {
    throw new Error("Host standalone runtime requires an exact source commit SHA.");
  }
  return [
    `FROM ${migrationImage}`,
    "WORKDIR /app",
    `LABEL org.ktcouriers.e2e.source-sha=\"${sourceSha}\"`,
    `LABEL org.ktcouriers.e2e.linux-prisma-image=\"${migrationImage}\"`,
    "ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000",
    "COPY --chown=node:node standalone-next/ ./.next/",
    "COPY --chown=node:node static/ ./.next/static/",
    "COPY --chown=node:node public/ ./public/",
    "COPY --chown=node:node catalog-media/ ./var/catalog-media/",
    "COPY --chown=node:node client-authority/ ./docs/client-authority/2026-10/",
    "COPY --chown=node:node standalone-server.js ./server.js",
    "CMD [\"node\", \"scripts/e2e-standalone-app.mjs\"]",
    "",
  ].join("\n");
}

function normalizedSpecPaths(args) {
  return args
    .map((argument) => argument.replaceAll("\\", "/"))
    .filter((argument) => /^tests\/e2e\/.+\.spec\.ts$/.test(argument));
}

export function isExactPhase2And3DirectedSelection(args) {
  const selectedSpecs = normalizedSpecPaths(args);
  if (selectedSpecs.length !== PHASE2_3_DIRECTED_SPECS.length) return false;

  const expected = new Set(PHASE2_3_DIRECTED_SPECS);
  if (new Set(selectedSpecs).size !== expected.size) return false;
  if (selectedSpecs.some((spec) => !expected.has(spec))) return false;

  return ["--project=chromium", "--retries=0", "--workers=1"].every((flag) => args.includes(flag));
}

export function playwrightTimeoutMs(args) {
  return isExactPhase2And3DirectedSelection(args)
    ? PHASE2_3_DIRECTED_TIMEOUT_MS
    : DEFAULT_PLAYWRIGHT_TIMEOUT_MS;
}
