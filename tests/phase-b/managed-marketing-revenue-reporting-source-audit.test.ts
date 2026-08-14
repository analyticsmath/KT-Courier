import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasPrismaField } from "./prisma-source-audit-helpers";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing revenue and reporting authority", () => {
  it("persists one canonical payment/billing reconciliation and append-only performance records", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811176000_phase_b_managed_marketing_revenue_reporting/migration.sql");
    expect(schema).toMatch(/MANAGED_MARKETING_REQUEST/);
    expect(schema).toMatch(/model ManagedMarketingBillingEvidence/);
    expect(hasPrismaField(schema, "ManagedMarketingBillingEvidence", "paymentId", "String @unique")).toBe(true);
    expect(hasPrismaField(schema, "ManagedMarketingBillingEvidence", "revenueLedgerJournalId", "String @unique")).toBe(true);
    expect(schema).toMatch(/model ManagedMarketingPerformanceRecord/);
    expect(migration).toMatch(/Payment_managedMarketingRequestId_key/);
    expect(migration).toMatch(/ManagedMarketingBillingEvidence/);
  });

  it("derives payment and revenue strictly from committed package snapshots and verified canonical payment evidence", () => {
    const service = read("lib/advertising/managed-marketing.service.ts");
    const processor = read("lib/payments/verified-payment-event-processor.service.ts");
    expect(service).toMatch(/committedCommercialAmounts/);
    expect(service).toMatch(/new Prisma\.Decimal\(request\.priceSnapshot\)/);
    expect(service).toMatch(/preparePayment/);
    expect(service).toMatch(/recognizeVerifiedPayment/);
    expect(service).toMatch(/payment\.status !== "SUCCEEDED"/);
    expect(service).toMatch(/postLedgerJournalWithinTransaction/);
    expect(service).toMatch(/MANAGED_MARKETING_BILLING_EVIDENCE_INVALID/);
    expect(processor).toMatch(/MANAGED_MARKETING_RECOGNIZED/);
    expect(processor).toMatch(/recognizeManagedMarketingRevenue/);
  });

  it("keeps store payment/reporting and admin performance/revenue reporting permission-scoped", () => {
    const permissions = read("lib/auth/permission-keys.ts");
    const storePayment = read("app/api/store/managed-marketing/requests/[reference]/payment/route.ts");
    const storeReport = read("app/api/store/managed-marketing/requests/[reference]/report/route.ts");
    const performance = read("app/api/admin/managed-marketing/requests/[reference]/performance/route.ts");
    const revenue = read("app/api/admin/managed-marketing/reports/revenue/route.ts");
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_PAY_OWN/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REQUESTS_RECORD_PERFORMANCE/);
    expect(permissions).toMatch(/MANAGED_MARKETING_REPORTS_READ/);
    expect(storePayment).toMatch(/MANAGED_MARKETING_PAYMENT_PREPARE/);
    expect(storeReport).toMatch(/getOwnReport/);
    expect(performance).toMatch(/MANAGED_MARKETING_REQUESTS_RECORD_PERFORMANCE/);
    expect(revenue).toMatch(/MANAGED_MARKETING_REPORTS_READ/);
  });
});
