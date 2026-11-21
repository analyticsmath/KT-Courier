import { describe, expect, it } from "vitest";
import {
  PRODUCTION_LOCK_REGISTER,
  getProductionLockReport,
} from "@/lib/governance/production-lock-register";

describe("Production Lock Register (§B.1)", () => {
  it("contains all authoritative platform locks with exact source references", () => {
    const identifiers = PRODUCTION_LOCK_REGISTER.map((l) => l.identifier);
    expect(identifiers).toContain("KT_COMMERCE_ENABLED");
    expect(identifiers).toContain("EVALUATE_COMMERCE_ACTIVATION");
    expect(identifiers).toContain("REFUND_PRODUCTION_READINESS");
    expect(identifiers).toContain("CUSTOMER_WALLET_BANK_WITHDRAWAL_LOCK");
    expect(identifiers).toContain("WITHDRAWAL_PAYOUT_READINESS");
    expect(identifiers).toContain("PROMOTIONS_RELEASE_GATE");
    expect(identifiers).toContain("ADVERTISING_PROGRAM_LOCK");
    expect(identifiers).toContain("PROMOTERS_PROGRAM_LOCK");
    expect(identifiers).toContain("STORE_CHECKOUT_TWO_REVIEWER_CERTIFICATION");
    expect(identifiers).toContain("COD_PHYSICAL_DELIVERY_SHORTAGE_ACCOUNTING");
  });

  it("enforces customer wallet bank withdrawal is permanently locked", () => {
    const custLock = PRODUCTION_LOCK_REGISTER.find(
      (l) => l.identifier === "CUSTOMER_WALLET_BANK_WITHDRAWAL_LOCK",
    );
    expect(custLock).toBeDefined();
    expect(custLock?.compiledPermanentlyLocked).toBe(true);
    expect(custLock?.currentResolution().resolvedValue).toBe(false);
  });

  it("evaluates all locks into an auditable report without throwing", () => {
    const report = getProductionLockReport();
    expect(report.length).toBe(PRODUCTION_LOCK_REGISTER.length);
    for (const item of report) {
      expect(item.identifier).toBeTruthy();
      expect(item.sourceFile).toBeTruthy();
      expect(item.scope).toBeTruthy();
      expect(item.reasonCode).toBeTruthy();
    }
  });
});
