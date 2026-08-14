import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("Phase B claims/remedies source contract", () => {
  it("keeps claims as an auditable case authority with private evidence and append-only history", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read("prisma/migrations/20260811150000_phase_b_claims_remedies/migration.sql");
    expect(schema).toMatch(/model Claim \{/);
    expect(schema).toMatch(/model ClaimEvidence \{/);
    expect(schema).toMatch(/model ClaimActivity \{/);
    expect(schema).toMatch(/model ClaimRemedy \{/);
    expect(migration).toMatch(/ClaimEvidence_private_media_guard/);
    expect(migration).toMatch(/claim activity is append-only/);
    expect(migration).toMatch(/claim evidence must use a CLAIM-owned private media object/);
  });

  it("requires canonical financial or shipping fulfilment authorities and an explicit mixed-payment boundary", () => {
    const service = read("lib/claims/claim.service.ts");
    expect(service).toMatch(/createRefundRequest/);
    expect(service).toMatch(/CLAIM_MIXED_POLICY_REQUIRED/);
    expect(service).toMatch(/ClaimRemedyType\.PARTIAL_REFUND/);
    expect(service).toMatch(/ClaimRemedyType\.FULL_REFUND/);
    expect(service).toMatch(/ClaimRemedyType\.STORE_CREDIT/);
    expect(service).toMatch(/claim-refund:\$\{claim\.id\}/);
    expect(service).toMatch(/CLAIM_FULL_REFUND_AMOUNT_SERVER_CONTROLLED/);
    expect(service).toMatch(/requestClaimFulfilmentRemedy/);
    expect(service).toMatch(/claim-fulfilment:\$\{claim\.id\}/);
    expect(read("lib/services/shipping-governance.service.ts")).toMatch(/NO_HARDCODED_REDELIVERY_FEE/);
  });

  it("composes canonical Shipping and Refund authorities through the Claim transaction client", () => {
    const claims = read("lib/claims/claim.service.ts");
    const shipping = read("lib/services/shipping-governance.service.ts");
    const refunds = read("lib/services/refund-request.service.ts");
    expect(claims).toMatch(/requestClaimFulfilmentRemedyInTransaction\(tx,/);
    expect(claims).toMatch(/createRefundRequestInTransaction\(tx,/);
    expect(claims).not.toMatch(/requestClaimFulfilmentRemedy\(\{ claimId: claim\.id/);
    expect(claims).not.toMatch(/createRefundRequest\(\{ actorUserId: claim\.claimantUserId/);
    expect(shipping).toMatch(/requestClaimFulfilmentRemedyInTransaction\(tx:/);
    expect(refunds).toMatch(/createRefundRequestInTransaction\(tx:/);
  });

  it("exposes thin customer, participant, and authorized-admin route contracts", () => {
    for (const file of [
      "app/api/claims/route.ts",
      "app/api/claims/[reference]/route.ts",
      "app/api/claims/[reference]/evidence/route.ts",
      "app/api/claims/[reference]/evidence/upload/route.ts",
      "app/api/claims/[reference]/responses/route.ts",
      "app/api/admin/claims/route.ts",
      "app/api/admin/claims/[reference]/finding/route.ts",
      "app/api/admin/claims/[reference]/activities/route.ts",
      "app/api/admin/claims/[reference]/fraud-flag/route.ts",
      "app/api/admin/claims/[reference]/remedy/route.ts",
      "app/api/store/claims/route.ts",
      "app/api/store/claims/[reference]/responses/route.ts",
      "app/api/driver/claims/route.ts",
      "app/api/driver/claims/[reference]/responses/route.ts",
    ]) expect(read(file)).toBeTruthy();
    expect(read("app/api/admin/claims/[reference]/finding/route.ts")).toMatch(/PERMISSIONS\.CLAIMS_INVESTIGATE/);
    expect(read("app/api/admin/claims/[reference]/remedy/route.ts")).toMatch(/PERMISSIONS\.CLAIMS_DECIDE/);
  });

  it("keeps claim media participant-scoped and does not grant claim media through generic media read permission", () => {
    const media = read("lib/private-media/private-media.service.ts");
    expect(media).toMatch(/Claim assets are case-scoped/);
    expect(media).toMatch(/PERMISSIONS\.CLAIMS_INVESTIGATE/);
    expect(media).toMatch(/checksum/);
  });
});
