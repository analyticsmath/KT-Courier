import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("frozen seller settlement evidence source boundary", () => {
  it("creates evidence during review and binds it to acknowledgement versions", () => {
    expect(source("lib/marketplace-checkout/checkout-review-persistence.service.ts")).toContain("freezeSettlementEvidence");
    expect(source("lib/marketplace-checkout/prisma-review-composition.repository.ts")).toContain("marketplaceCheckoutStoreSettlementEvidence.create");
    expect(source("lib/marketplace-checkout/prisma-review-composition.repository.ts")).toContain("settlementEvidenceVersions");
  });

  it("has the finalizer consume frozen evidence without mutable seller or commission-plan lookups", () => {
    const finalizer = source("lib/marketplace-checkout/prisma-marketplace-finalization.repository.ts");
    expect(finalizer).toContain("marketplaceCheckoutStoreSettlementEvidence.findMany");
    expect(finalizer).not.toContain("db.commissionPlan");
    expect(finalizer).not.toContain("db.storeSellerLegalIdentity");
    expect(finalizer).not.toContain("function distribute");
  });

  it("passes frozen commission beneficiary evidence into the Phase 14 settlement primitive", () => {
    const settlement = source("lib/marketplace-checkout/prisma-marketplace-settlement.repository.ts");
    expect(settlement).toContain("sourceSettlementEvidence");
    expect(settlement).toContain("frozenCommissionBeneficiaries");
    expect(settlement).toContain("beneficiarySnapshots: settlement.snapshot.commissionBeneficiarySnapshots");
  });
});
