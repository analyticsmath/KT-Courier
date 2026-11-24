import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { evaluateCodPolicyReadiness } from "@/lib/production-readiness/cod-readiness";
import { evaluateCommissionPlanCoverage } from "@/lib/production-readiness/commission-plan-coverage";
import { reconcileBoardWithCapabilityMatrix } from "@/lib/production-readiness/reconciliation";
import type { CapabilityMatrixEntry } from "@/lib/production-readiness/capability-matrix.service";
import type { Capability } from "@/lib/production-readiness/contracts";

describe("board scope reconciliation, COD readiness parity, and commission coverage parity", () => {
  it("reconciles capabilityMatrix with register entries so in-scope matrix blockers forbid unrestricted READY", () => {
    const entries: Capability[] = [
      {
        key: "payment_integration_acceptance",
        status: "READY",
        severity: "INFO",
        reasonCode: "OK",
        safeSummary: "Ready",
        owner: "FINANCE",
      },
      {
        key: "subscriptions_billing",
        status: "DISABLED_BY_POLICY",
        severity: "WARNING",
        reasonCode: "EXCLUDED",
        safeSummary: "Excluded",
        owner: "CLIENT",
      },
    ];

    const matrixWithBlockedInScope: CapabilityMatrixEntry[] = [
      {
        key: "STORE_CHECKOUT",
        label: "Marketplace store checkout",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: true,
        externalEntitlementApproved: true,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: true,
        eligibleForLiveUse: false,
        lastBlockerCode: "NO_ACTIVE_STORE_ORDER_OPERATIONAL_POLICY",
      },
      {
        key: "SUBSCRIPTIONS",
        label: "Subscriptions",
        sourceImplemented: true,
        isolatedTestPassSha: null,
        runtimeConfigured: false,
        externalEntitlementApproved: false,
        adminPolicyEffective: false,
        schedulerRegisteredAndHealthy: null,
        eligibleForLiveUse: false,
        lastBlockerCode: "DISABLED_BY_POLICY",
      },
    ];

    const reconciled = reconcileBoardWithCapabilityMatrix(entries, matrixWithBlockedInScope);
    expect(reconciled.overallStatus).toBe("BLOCKED");
    expect(reconciled.registerReady).toBe(true);
    expect(reconciled.inScopeMatrixBlockers).toEqual(["STORE_CHECKOUT"]);
    expect(reconciled.excludedCapabilities).toEqual(["SUBSCRIPTIONS"]);

    const allClearMatrix: CapabilityMatrixEntry[] = [
      {
        ...matrixWithBlockedInScope[0],
        adminPolicyEffective: true,
        eligibleForLiveUse: true,
        lastBlockerCode: null,
      },
      matrixWithBlockedInScope[1],
    ];
    const readyReconciled = reconcileBoardWithCapabilityMatrix(entries, allClearMatrix);
    expect(readyReconciled.overallStatus).toBe("READY");
    expect(readyReconciled.inScopeMatrixBlockers).toEqual([]);
  });

  it("enforces exact COD policy parity: active delivery service, usable active region, 50/50 split, positive cap, maker!=approver!=bankAuthor", () => {
    const now = new Date("2026-11-24T12:00:00.000Z");
    const validPolicy = {
      id: "pol_1",
      status: "ACTIVE",
      mode: "DEPOSIT_PLUS_COD",
      storeId: null,
      orderType: "PARCEL_DOCUMENT",
      depositPercent: new Prisma.Decimal("0.5000"),
      depositAmount: null,
      deliveryServiceId: "STANDARD",
      regionId: "reg_gp",
      provinceScope: ["Gauteng"],
      maximumCodAmount: new Prisma.Decimal("1500.00"),
      effectiveFrom: new Date("2026-11-24T00:00:00.000Z"),
      effectiveTo: null,
      createdByUserId: "maker_1",
      policyEvidence: {
        approvedByUserId: "approver_2",
        approvedAt: "2026-11-24T01:00:00.000Z",
        remittanceApproved: true,
        remittanceUpdatedAt: "2026-11-24T00:30:00.000Z",
        settlementTiming: "Same business day by 17:00 SAST",
      },
    };
    const validServices = new Map([["STANDARD", { stableKey: "STANDARD", status: "ACTIVE", effectiveFrom: new Date("2026-11-01T00:00:00Z"), effectiveTo: null }]]);
    const validRegions = new Map([["reg_gp", { id: "reg_gp", active: true, pricingEnabled: true, province: "Gauteng", coverageMode: "RADIUS", centerLat: -26.2, centerLng: 28.04, coverageRadiusKm: 40, maxDistanceKm: 60 }]]);
    const validBank = { valid: true, updatedAtIso: "2026-11-24T00:30:00.000Z", updatedByUserId: "bank_author_3" };

    expect(evaluateCodPolicyReadiness([validPolicy], { activeServicesByKey: validServices, regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(1);
    expect(evaluateCodPolicyReadiness([validPolicy], { activeServicesByKey: null, regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(0);
    expect(evaluateCodPolicyReadiness([validPolicy], { activeServicesByKey: validServices, regionsById: null, bank: validBank, now }).eligible).toHaveLength(0);
    expect(evaluateCodPolicyReadiness([validPolicy], { activeServicesByKey: new Map(), regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(0);

    const badRegions = new Map([["reg_gp", { id: "reg_gp", active: false, pricingEnabled: false, province: "Gauteng", coverageMode: "RADIUS", centerLat: null, centerLng: null, coverageRadiusKm: null, maxDistanceKm: null }]]);
    expect(evaluateCodPolicyReadiness([validPolicy], { activeServicesByKey: validServices, regionsById: badRegions, bank: validBank, now }).eligible).toHaveLength(0);

    const pricingDisabledRegion = new Map([["reg_gp", { id: "reg_gp", active: true, pricingEnabled: false, province: "Gauteng", coverageMode: "RADIUS", centerLat: -26.2, centerLng: 28.04, coverageRadiusKm: 40, maxDistanceKm: 60 }]]);
    expect(evaluateCodPolicyReadiness([{ ...validPolicy, regionId: null }], { activeServicesByKey: validServices, regionsById: pricingDisabledRegion, bank: validBank, now }).eligible).toHaveLength(0);

    const invalidProvince = { ...validPolicy, regionId: null, provinceScope: ["Atlantis"] };
    expect(evaluateCodPolicyReadiness([invalidProvince], { activeServicesByKey: validServices, regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(0);

    const futureApproved = { ...validPolicy, policyEvidence: { ...validPolicy.policyEvidence, approvedAt: "2099-01-01T00:00:00.000Z" } };
    expect(evaluateCodPolicyReadiness([futureApproved], { activeServicesByKey: validServices, regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(0);

    const selfApproved = { ...validPolicy, policyEvidence: { ...validPolicy.policyEvidence, approvedByUserId: "maker_1" } };
    expect(evaluateCodPolicyReadiness([selfApproved], { activeServicesByKey: validServices, regionsById: validRegions, bank: validBank, now }).eligible).toHaveLength(0);
  });

  it("enforces commission coverage ambiguity refusal, maker!=approver, and valid rate bounds", () => {
    const basePlan = {
      subjectType: "COURIER_ORDER",
      scopeKey: "GLOBAL:COURIER_ORDER",
      currency: "ZAR",
      status: "ACTIVE",
      basisType: "ORDER_TOTAL",
      effectiveFrom: new Date("2026-11-01T00:00:00.000Z"),
      effectiveUntil: null,
      calculationVersion: "v1",
      createdByUserId: "maker_1",
      approvedByUserId: "reviewer_2",
      approvedAt: new Date("2026-11-01T00:00:00.000Z"),
      rules: [{ calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 7000 }],
    };

    const ok = evaluateCommissionPlanCoverage({
      plans: [
        basePlan,
        {
          ...basePlan,
          subjectType: "MARKETPLACE_STORE_ORDER",
          scopeKey: "STORE:store_1",
          basisType: "ORDER_SUBTOTAL",
          rules: [{ calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 800 }],
        },
      ],
      activeStoreIds: ["store_1"],
      now: new Date("2026-11-24T12:00:00.000Z"),
    });
    expect(ok.ready).toBe(true);
    expect(ok.reasonCode).toBe("APPROVED_COMMISSION_SCOPE_COVERAGE_CURRENT");

    // Overlapping active courier plans fail closed on ambiguity
    const ambiguous = evaluateCommissionPlanCoverage({
      plans: [basePlan, { ...basePlan, calculationVersion: "v2" }],
      activeStoreIds: [],
      now: new Date("2026-11-24T12:00:00.000Z"),
    });
    expect(ambiguous.ready).toBe(false);
    expect(ambiguous.reasonCode).toBe("COURIER_COMMISSION_SCOPE_AMBIGUOUS");

    // Invalid >100% rateBasisPoints rejected
    const badRate = evaluateCommissionPlanCoverage({
      plans: [{ ...basePlan, rules: [{ calculationMethod: "PERCENTAGE_BPS", rateBasisPoints: 12000 }] }],
      activeStoreIds: [],
      now: new Date("2026-11-24T12:00:00.000Z"),
    });
    expect(badRate.ready).toBe(false);

    // Maker === approver rejected
    const selfApproved = evaluateCommissionPlanCoverage({
      plans: [{ ...basePlan, approvedByUserId: "maker_1" }],
      activeStoreIds: [],
      now: new Date("2026-11-24T12:00:00.000Z"),
    });
    expect(selfApproved.ready).toBe(false);
  });
});
