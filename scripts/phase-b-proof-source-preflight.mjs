import fs from "node:fs";
import path from "node:path";

const required = [
  "tests/phase-b/cod-proof-source-audit.test.ts",
  "tests/phase-b/claims-remedies-source-audit.test.ts",
  "tests/phase-b/claims-remedies-postgres.test.ts",
  "tests/phase-b/promoter-programme-source-audit.test.ts",
  "tests/phase-b/promoter-programme-postgres.test.ts",
  "tests/phase-b/managed-marketing-privacy-source-audit.test.ts",
  "tests/phase-b/managed-marketing-package-source-audit.test.ts",
  "tests/phase-b/private-media-vehicle-postgres.test.ts",
  "lib/services/cash-on-delivery.service.ts",
  "lib/claims/claim.service.ts",
  "prisma/migrations/20260811140000_phase_b_cod_cash_custody/migration.sql",
  "prisma/migrations/20260811150000_phase_b_claims_remedies/migration.sql",
  "prisma/migrations/20260811160000_phase_b_promoter_programme_closure/migration.sql",
  "prisma/migrations/20260811170000_phase_b_managed_marketing_privacy_closure/migration.sql",
  "prisma/migrations/20260811172000_phase_b_managed_marketing_package_channel_authority/migration.sql",
  "tests/phase-b/shipping-pod-postgres.test.ts",
  "tests/phase-b/shipping-final-postgres.test.ts",
  "tests/phase-b/privacy-dsar-retention-postgres.test.ts",
  "tests/phase-b/privacy-location-security-postgres.test.ts",
  "tests/phase-b/legal-policy-version-evidence-postgres.test.ts",
  "prisma/migrations/20260811183000_phase_b_shipping_package_vendor_driver_controls/migration.sql",
  "prisma/migrations/20260811184000_phase_b_claim_fulfilment_remedy_bridge/migration.sql",
];
const phaseBDirectory = path.join(process.cwd(), "tests", "phase-b");
const runtimeConfig = "vitest.phase-b-runtime.config.ts";
const runtimeGlob = "tests/phase-b/**/*-postgres.test.ts";
const postgresSuites = fs.readdirSync(phaseBDirectory)
  .filter((file) => file.endsWith("-postgres.test.ts"))
  .map((file) => path.join("tests", "phase-b", file))
  .sort();
const proofFiles = [...new Set([...required, ...postgresSuites])];
const missing = proofFiles.filter((file) => !fs.existsSync(file));
const invalid = proofFiles.filter((file) => fs.existsSync(file) && /\b(?:describe|it|test)\.(?:skip|todo)\b|\[SKIP_TEST\]|\bif\s*\([^)]*(?:process\.env|DATABASE_URL|KT_ALLOW_)[^)]*\)\s*(?:\{\s*)?return\b|fixture[^\n]{0,100}(?:missing|unavailable)[^\n]{0,100}return/i.test(fs.readFileSync(file, "utf8")));
const emptySuites = postgresSuites.filter((file) => !/\b(?:describe|it|test)\s*\(/.test(fs.readFileSync(file, "utf8")));
const runtimeConfigText = fs.existsSync(runtimeConfig) ? fs.readFileSync(runtimeConfig, "utf8") : "";
const configuredSuites = runtimeConfigText.includes(runtimeGlob) ? [...postgresSuites] : [];
const discoveryMismatch = postgresSuites.length !== configuredSuites.length || postgresSuites.some((suite, index) => suite !== configuredSuites[index]);
const unexpectedRuntimeExclusion = /exclude\s*:\s*\[[\s\S]*?phase-b[\s\S]*?postgres/i.test(runtimeConfigText);
if (missing.length || invalid.length || emptySuites.length || !runtimeConfigText || discoveryMismatch || unexpectedRuntimeExclusion) {
  console.error(`PHASE_B_PROOF_SOURCE_PREFLIGHT=FAILED missing=${missing.join(",") || "none"} invalid=${invalid.join(",") || "none"} empty=${emptySuites.join(",") || "none"} runtimeConfig=${runtimeConfigText ? "present" : "missing"} discoveryMismatch=${discoveryMismatch} unexpectedRuntimeExclusion=${unexpectedRuntimeExclusion}`);
  process.exit(1);
}
console.log(`PHASE_B_PROOF_SOURCE_PREFLIGHT=PASSED postgresSuites=${postgresSuites.length} runtimeGlob=${runtimeGlob}`);
console.log("Phase B PostgreSQL runtime proof remains USER_RUNTIME_PROOF_PENDING; this check verifies source existence, exact runtime discovery, non-empty suites, and no false-green skip/environment-return markers.");
