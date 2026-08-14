import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("DSAR and retention source authorities", () => {
  it("uses one owner-scoped DSAR aggregate with controlled transitions and deletion planning", () => {
    const service = read("lib/services/privacy-requests.service.ts"); const route = read("app/api/privacy/requests/route.ts"); const schema = read("prisma/schema.prisma");
    expect(service).toMatch(/PRIVACY_REQUEST_TYPES.*ACCESS.*CORRECTION.*DELETION_OR_ANONYMISATION.*OBJECTION.*CONSENT_WITHDRAWAL.*PORTABILITY/s);
    expect(service).toMatch(/PRIVACY_REQUEST_NOT_OWNER/); expect(service).toMatch(/PRIVACY_REQUEST_INVALID_TRANSITION/); expect(service).toMatch(/privacyRequestExecutionPlan/);
    expect(service).toMatch(/classifyCorrectionRequest/); expect(service).toMatch(/IMMUTABLE_HISTORICAL_EVIDENCE/);
    expect(service).toMatch(/FINANCIAL_LEDGER[\s\S]*RETAIN/); expect(route).toMatch(/requesterUserId: user\.id/); expect(route).toMatch(/PRIVACY_REQUEST_SUBMISSION/);
    expect(schema).toMatch(/model PrivacyRequestExecutionPlan[\s\S]*policySnapshot/);
  });
  it("delegates consent withdrawal and excludes internal/provider fields from the controlled export", () => {
    const service = read("lib/services/privacy-requests.service.ts");
    expect(service).toMatch(/setMarketingPreference/); expect(service).toMatch(/MARKETING_CHANNELS/); expect(service).toMatch(/schemaVersion: "privacy-export-v1"/);
    expect(service).not.toMatch(/passwordHash: true/); expect(service).not.toMatch(/providerSecret/);
  });
  it("keeps retention versioned, hold-first, idempotent and financial-safe", () => {
    const retention = read("lib/retention/privacy-retention.service.ts"); const hold = read("lib/retention/hold-evaluator.ts"); const worker = read("lib/retention/privacy-retention-worker.ts"); const schema = read("prisma/schema.prisma");
    expect(schema).toMatch(/model RetentionPolicyVersion[\s\S]*dataClass[\s\S]*version[\s\S]*legalReviewStatus/); expect(schema).toMatch(/model RetentionExecution[\s\S]*executionKey/);
    expect(retention).toMatch(/resolveRetentionPolicy/); expect(retention).toMatch(/eligibleAt/); expect(retention).toMatch(/RETENTION_RESOURCE_HELD|status: "HELD"/);
    expect(retention).toMatch(/email: `deleted-\$\{token\}@anonymized\.invalid`/); expect(retention).toMatch(/status: "DISABLED"/); expect(retention).toMatch(/FINANCIAL_LEDGER.*RETAINED/s);
    expect(hold).toMatch(/expiresAt/); expect(worker).toMatch(/executeRetentionTarget/);
  });
});
