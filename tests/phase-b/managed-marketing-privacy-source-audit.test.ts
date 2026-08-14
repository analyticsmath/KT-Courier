import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("managed marketing and privacy source closure", () => {
  it("keeps external managed marketing distinct, versioned and manual-capable", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811170000_phase_b_managed_marketing_privacy_closure/migration.sql");
    const service = read("lib/advertising/managed-marketing.service.ts").replace(/\s+/g, "");

    expect(schema).toMatch(/ManagedMarketingChannel/);
    expect(schema).toMatch(/AUTOMATED_PROVIDER/);
    expect(migration).toMatch(/package versions are immutable/);
    expect(service).toMatch(/PROVIDER_NOT_CONFIGURED/);
    expect(service).toContain('mode==="MANUAL"');
  });

  it("keeps policy acceptance, marketing consent and retention authorities separate", () => {
    expect(read("lib/services/legal-documents.service.ts")).toMatch(/recordLegalAcceptance/);
    expect(read("app/api/notifications/consents/marketing/route.ts")).toMatch(/purpose: "MARKETING"/);
    expect(read("lib/notifications/contracts.ts")).toMatch(/CONSENT_REQUIRED/);
    expect(read("lib/retention/retention-processor.ts")).toMatch(/evaluateRetentionHolds/);
    expect(read("lib/services/privacy-requests.service.ts")).toMatch(/PRIVACY_IDENTITY_VERIFICATION_REQUIRED/);
  });
});
