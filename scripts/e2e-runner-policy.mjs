export const DEFAULT_PLAYWRIGHT_TIMEOUT_MS = 15 * 60 * 1000;
export const PHASE1_FULL_CHROMIUM_TIMEOUT_MS = 45 * 60 * 1000;
export const PHASE2_3_DIRECTED_TIMEOUT_MS = 45 * 60 * 1000;

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
