import { describe, expect, it, vi } from "vitest";
import { classifyStoreCommissionReadiness, getStoreCommissionReadiness } from "@/lib/admin/store-commission-readiness";

const now = new Date("2026-10-24T12:00:00.000Z");
const active = {
  id: "policy-1", publicReference: "CP-STORE-V1", versionNumber: 1,
  status: "ACTIVE", approvedAt: new Date("2026-10-20"), effectiveFrom: new Date("2026-10-21"),
  effectiveUntil: null, rules: [{ id: "rule" }],
};

describe("marketplace store settlement readiness", () => {
  it("shows a missing plan as a commercial onboarding requirement rather than allowing checkout", () => {
    expect(classifyStoreCommissionReadiness([], null, now)).toMatchObject({ status: "MISSING", ready: false });
  });
  it("an approved draft is not sufficient until ACTIVATED", () => {
    expect(classifyStoreCommissionReadiness([{ ...active, status: "APPROVED" }], null, now))
      .toMatchObject({ status: "APPROVED_NOT_ACTIVE", ready: false, planId: "policy-1" });
  });
  it("detects inactive expired or future plans", () => {
    expect(classifyStoreCommissionReadiness([{ ...active, effectiveUntil: new Date("2026-10-22") }], null, now))
      .toMatchObject({ status: "OUTSIDE_EFFECTIVE_PERIOD", ready: false });
    expect(classifyStoreCommissionReadiness([{ ...active, effectiveFrom: new Date("2026-11-01") }], null, now))
      .toMatchObject({ status: "OUTSIDE_EFFECTIVE_PERIOD", ready: false });
  });
  it("allows only independently approved active store plans with rules", () => {
    expect(classifyStoreCommissionReadiness([active], null, now)).toMatchObject({ status: "READY", ready: true });
    expect(classifyStoreCommissionReadiness([{ ...active, approvedAt: null }], null, now).ready).toBe(false);
    expect(classifyStoreCommissionReadiness([{ ...active, rules: [] }], null, now).ready).toBe(false);
  });
  it("prevents a subscribed store from silently receiving a different plan", () => {
    expect(classifyStoreCommissionReadiness([active], { planReference: "CP-OTHER", planVersion: 1 }, now))
      .toMatchObject({ status: "ENTITLEMENT_MISMATCH", ready: false });
    expect(classifyStoreCommissionReadiness([active], { planReference: "CP-STORE-V1", planVersion: 1 }, now))
      .toMatchObject({ status: "READY", ready: true });
    expect(classifyStoreCommissionReadiness([active], { planReference: null, planVersion: null }, now))
      .toMatchObject({ status: "ENTITLEMENT_MISMATCH", ready: false });
  });
  it("reads only the specific store scope, never a global commission as fallback", async () => {
    const database = {
      commissionPlan: { findMany: vi.fn().mockResolvedValue([active]) },
      subscriptionEntitlementGrant: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const result = await getStoreCommissionReadiness("store-123", database as never, now);
    expect(result.ready).toBe(true);
    expect(database.commissionPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: "STORE:store-123", currency: "ZAR" },
    }));
  });
});
