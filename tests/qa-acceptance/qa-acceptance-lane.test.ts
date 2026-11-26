import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isQaSandboxPlatformAccountCode,
  QA_ACCEPTANCE_PLATFORM_ACCOUNTS,
  QA_ACCEPTANCE_PLATFORM_OWNER_ID,
  resolveQaAcceptanceLaneConfig,
  resolveQaPaystackRuntimeConfig,
  resolveQaPaystackWebhookSecrets,
} from "@/lib/qa-acceptance/config";
import {
  DEFAULT_STORE_OPERATING_HOURS,
  formatStoreOperatingHoursSummary,
  parseStoreOperatingHours,
  StoreOperatingHoursSchema,
} from "@/lib/qa-acceptance/operating-hours";
import { assertLedgerPostingNamespaceIsolation } from "@/lib/qa-acceptance/ledger";
import {
  activePublicProductDocumentSql,
  activePublicStoreDocumentSql,
  activeQaProductDocumentSql,
  activeQaStoreDocumentSql,
} from "@/lib/storefront/sql-store-publication";
import { LedgerError } from "@/lib/ledger/errors";

function readRepo(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

const syntheticKey = (kind: "live" | "test", suffix: string) => ["sk", kind, suffix].join("_");

describe("QA Acceptance Lane config fail-closed invariants", () => {
  it("disables the lane when explicit feature flags are absent", () => {
    const sampleTestKey = syntheticKey("test", "0123456789abcdef0123456789abcdef");
    const config = resolveQaAcceptanceLaneConfig({
      NODE_ENV: "production",
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: sampleTestKey,
    });
    expect(config.eligible).toBe(false);
    expect(config.laneFlagEnabled).toBe(false);
    expect(config.secretSource).toBe("NONE");
    expect(() => resolveQaPaystackRuntimeConfig({
      NODE_ENV: "production",
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: sampleTestKey,
    })).toThrow();
  });

  it("refuses live sk_live_ keys or matching live secret key", () => {
    const livePrefix = resolveQaAcceptanceLaneConfig({
      QA_ACCEPTANCE_LANE_ENABLED: "true",
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: syntheticKey("live", "0123456789abcdef0123456789abcdef"),
    });
    expect(livePrefix.eligible).toBe(false);
    expect(livePrefix.reason).toContain("sk_test_");

    const identicalKey = syntheticKey("test", "identicalkey1234567890");
    const sameAsLive = resolveQaAcceptanceLaneConfig({
      QA_ACCEPTANCE_LANE_ENABLED: "true",
      PAYSTACK_SECRET_KEY: identicalKey,
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: identicalKey,
    });
    expect(sameAsLive.eligible).toBe(false);
  });

  it("refuses when conflicting PAYSTACK_TEMPORARY_SANDBOX_ENABLED is active", () => {
    const config = resolveQaAcceptanceLaneConfig({
      QA_ACCEPTANCE_LANE_ENABLED: "true",
      PAYSTACK_TEMPORARY_SANDBOX_ENABLED: "true",
      PAYSTACK_TEMPORARY_SANDBOX_SECRET_KEY: syntheticKey("test", "temp0123456789abcdef"),
    });
    expect(config.eligible).toBe(false);
    expect(config.reason).toContain("PAYSTACK_TEMPORARY_SANDBOX_ENABLED");
  });

  it("enables cleanly with explicit flag and dedicated sk_test_ secret without exposing secret value", () => {
    const qaSecret = syntheticKey("test", "isolated_qa_key_0123456789");
    const env = {
      QA_ACCEPTANCE_LANE_ENABLED: "true",
      PAYSTACK_SECRET_KEY: syntheticKey("live", "production_key_do_not_use"),
      PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY: qaSecret,
      PAYSTACK_ACCEPTANCE_SANDBOX_PUBLIC_KEY: ["pk", "test", "isolated_qa_key_0123456789"].join("_"),
      RAILWAY_GIT_COMMIT_SHA: "abc123def456",
    };
    const config = resolveQaAcceptanceLaneConfig(env);
    expect(config.eligible).toBe(true);
    expect(config.secretSource).toBe("PAYSTACK_ACCEPTANCE_SANDBOX_SECRET_KEY");
    expect(JSON.stringify(config)).not.toContain(qaSecret);

    const runtime = resolveQaPaystackRuntimeConfig(env);
    expect(runtime.environment).toBe("sandbox");
    expect(runtime.secretKey).toBe(qaSecret);

    const webhookSecrets = resolveQaPaystackWebhookSecrets(env);
    expect(webhookSecrets).toContain(qaSecret);
  });
});

describe("Store operating hours schema and projection", () => {
  it("validates structured 7-day hours and rejects invalid intervals", () => {
    expect(StoreOperatingHoursSchema.safeParse(DEFAULT_STORE_OPERATING_HOURS).success).toBe(true);
    const bad = StoreOperatingHoursSchema.safeParse({
      ...DEFAULT_STORE_OPERATING_HOURS,
      days: {
        ...DEFAULT_STORE_OPERATING_HOURS.days,
        monday: { closed: false, open: "18:00", close: "08:00" },
      },
    });
    expect(bad.success).toBe(false);
    expect(parseStoreOperatingHours("not-an-object")).toBeNull();
  });

  it("formats configured trading hours clearly", () => {
    const formatted = formatStoreOperatingHoursSummary(DEFAULT_STORE_OPERATING_HOURS);
    expect(formatted.configured).toBe(true);
    expect(formatted.statusLabel).toBe("TRADING_HOURS_CONFIGURED");
    expect(formatted.summary).toContain("Mon: 08:00-17:00");
    expect(formatted.summary).toContain("Sun: Closed");
  });
});

describe("Public vs QA SQL storefront isolation & ledger separation", () => {
  it("excludes isQaAcceptance stores and products from public SQL filters and includes them only in QA SQL filters", () => {
    expect(activePublicStoreDocumentSql.strings.join("?")).toContain('store."isQaAcceptance" = false');
    expect(activePublicProductDocumentSql.strings.join("?")).toContain('store."isQaAcceptance" = false');
    expect(activeQaStoreDocumentSql.strings.join("?")).toContain('store."isQaAcceptance" = true');
    expect(activeQaProductDocumentSql.strings.join("?")).toContain('store."isQaAcceptance" = true');
    expect(activeQaStoreDocumentSql.strings.join("?")).toContain(`cert."status" = 'APPROVED'`);
  });

  it("recognizes sandbox platform account codes and blocks QA/live cross-contamination", () => {
    expect(QA_ACCEPTANCE_PLATFORM_OWNER_ID).toBe("platform-sandbox-acceptance");
    expect(isQaSandboxPlatformAccountCode(QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode)).toBe(true);
    expect(isQaSandboxPlatformAccountCode("PLATFORM-CASH-CLEARING-ZAR")).toBe(false);

    expect(() =>
      assertLedgerPostingNamespaceIsolation([
        {
          code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode,
          wallet: { ownerType: "PLATFORM", ownerId: "platform-sandbox-acceptance", isQaIsolated: true },
        },
        {
          code: "LIVE-STORE-PAYABLE",
          wallet: { ownerType: "STORE", ownerId: "store_live_1", isQaIsolated: false },
        },
      ]),
    ).toThrowError(LedgerError);

    expect(() =>
      assertLedgerPostingNamespaceIsolation([
        {
          code: "PLATFORM-CASH-CLEARING-ZAR",
          wallet: { ownerType: "PLATFORM", ownerId: "platform", isQaIsolated: false },
        },
        {
          code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.fundsHeldCode,
          wallet: { ownerType: "PLATFORM", ownerId: "platform-sandbox-acceptance", isQaIsolated: true },
        },
      ]),
    ).toThrowError(LedgerError);

    expect(() =>
      assertLedgerPostingNamespaceIsolation([
        {
          code: QA_ACCEPTANCE_PLATFORM_ACCOUNTS.cashClearingCode,
          wallet: { ownerType: "PLATFORM", ownerId: "platform-sandbox-acceptance", isQaIsolated: true },
        },
        {
          code: "QA-STORE-PAYABLE",
          wallet: { ownerType: "STORE", ownerId: "store_qa_1", isQaIsolated: true },
        },
      ]),
    ).not.toThrow();
  });

  it("excludes QA records from commercial reporting, finance dashboard, ledger, and earning summaries", () => {
    expect(readRepo("lib/services/finance-dashboard.service.ts")).toContain("isQaIsolated: false");
    expect(readRepo("lib/reporting/report-generator.ts")).toContain("isQaIsolated: false");
    expect(readRepo("lib/services/ledger-query.service.ts")).toContain("isQaIsolated: true");
    expect(readRepo("lib/services/store-earning-summary.service.ts")).toContain("isQaAcceptance: false");
    expect(readRepo("lib/services/driver-earning-summary.service.ts")).toContain("isQaAcceptance: false");
    expect(readRepo("lib/services/payment-query.service.ts")).toContain("isQaAcceptance: false");
  });
});
