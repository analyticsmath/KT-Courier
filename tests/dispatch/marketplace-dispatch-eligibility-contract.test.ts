import { describe, expect, it } from "vitest";
import {
  evaluateMarketplaceStoreOrderEligibility,
  assertMarketplaceStoreOrderEligibility,
  resolveMarketplaceStoreOrderPaymentMode,
  MarketplaceDispatchEligibilityError,
  MARKETPLACE_STORE_ORDER_DISPATCH_ELIGIBLE_WHERE,
  type MarketplaceStoreOrderEligibilityCandidate,
} from "@/lib/services/marketplace-dispatch-contract.service";

describe("Canonical Marketplace Dispatch Eligibility Contract", () => {
  const baseValidStoreOrder: MarketplaceStoreOrderEligibilityCandidate = {
    id: "so-valid",
    publicReference: "MSO-VALID-1",
    status: "SETTLED",
    acceptanceStatus: "ACCEPTED",
    preparationStatus: "READY_FOR_HANDOFF",
    derivedStatus: "READY_FOR_PICKUP",
    resolutionStatus: "CLEAR",
    financialResolutionStatus: "UNCHANGED",
    cancellationRequests: [],
    checkoutStoreGroup: { paymentPlan: null },
  };

  const validCodPaymentPlan = {
    version: "marketplace-payment-v1",
    mode: "DEPOSIT_PLUS_COD",
    authoritativeTotal: "250.00",
    digitalRequired: "50.00",
    cashRequired: "200.00",
    policyId: "pol_cod_test_123",
    policyVersion: 1,
    policyEvidence: { test: true },
  };

  describe("resolveMarketplaceStoreOrderPaymentMode", () => {
    it("resolves valid DEPOSIT_PLUS_COD payment plan as COD", () => {
      const res = resolveMarketplaceStoreOrderPaymentMode({
        checkoutStoreGroup: { paymentPlan: validCodPaymentPlan },
      });
      expect(res.isCod).toBe(true);
      expect(res.paymentPlan?.mode).toBe("DEPOSIT_PLUS_COD");
    });

    it("fails closed to non-COD/prepaid for missing paymentPlan", () => {
      const res = resolveMarketplaceStoreOrderPaymentMode({
        checkoutStoreGroup: { paymentPlan: null },
      });
      expect(res.isCod).toBe(false);
      expect(res.paymentPlan).toBeNull();
    });

    it("fails closed to non-COD/prepaid for malformed paymentPlan", () => {
      const res = resolveMarketplaceStoreOrderPaymentMode({
        checkoutStoreGroup: { paymentPlan: { mode: "DEPOSIT_PLUS_COD", broken: true } },
      });
      expect(res.isCod).toBe(false);
      expect(res.paymentPlan).toBeNull();
    });
  });

  describe("Commercial Status & Payment Mode Dimensions", () => {
    it("permits SETTLED prepaid store orders across all dispatch stages", () => {
      const stages = [
        "COURIER_ORDER_CREATION",
        "DISPATCH_CANDIDATE_SCAN",
        "OFFER_ASSIGNMENT",
        "DRIVER_ACCEPTANCE",
        "RECOVERY",
      ] as const;
      for (const stage of stages) {
        const result = evaluateMarketplaceStoreOrderEligibility(baseValidStoreOrder, { stage });
        expect(result.eligible).toBe(true);
        expect(() => assertMarketplaceStoreOrderEligibility(baseValidStoreOrder, { stage })).not.toThrow();
      }
    });

    it("strictly rejects undocumented CONFIRMED status synonym for prepaid orders", () => {
      const order = { ...baseValidStoreOrder, status: "CONFIRMED" };
      const result = evaluateMarketplaceStoreOrderEligibility(order, {
        stage: "DISPATCH_CANDIDATE_SCAN",
        isCod: false,
      });
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("STORE_ORDER_NOT_SETTLED");
    });

    it("rejects non-SETTLED prepaid store orders with STORE_ORDER_NOT_SETTLED", () => {
      const nonSettledStatuses = ["PENDING_SETTLEMENT", "PENDING_STORE_REVIEW"];
      for (const status of nonSettledStatuses) {
        const order = { ...baseValidStoreOrder, status };
        const result = evaluateMarketplaceStoreOrderEligibility(order, {
          stage: "DISPATCH_CANDIDATE_SCAN",
          isCod: false,
        });
        expect(result.eligible).toBe(false);
        expect(result.code).toMatch(/STORE_ORDER_(NOT_SETTLED|STATUS_INELIGIBLE)/);
        expect(() =>
          assertMarketplaceStoreOrderEligibility(order, { stage: "DISPATCH_CANDIDATE_SCAN", isCod: false })
        ).toThrow(MarketplaceDispatchEligibilityError);
      }
    });

    it("allows PENDING_SETTLEMENT for valid Cash On Delivery orders", () => {
      const codOrder: MarketplaceStoreOrderEligibilityCandidate = {
        ...baseValidStoreOrder,
        status: "PENDING_SETTLEMENT",
        checkoutStoreGroup: {
          paymentPlan: validCodPaymentPlan,
        },
      };
      const result = evaluateMarketplaceStoreOrderEligibility(codOrder, {
        stage: "DISPATCH_CANDIDATE_SCAN",
        isCod: true,
      });
      expect(result.eligible).toBe(true);
    });

    it("automatically infers isCod=true from valid checkoutStoreGroup paymentPlan when not explicitly passed", () => {
      const codOrder: MarketplaceStoreOrderEligibilityCandidate = {
        ...baseValidStoreOrder,
        status: "PENDING_SETTLEMENT",
        checkoutStoreGroup: {
          paymentPlan: validCodPaymentPlan,
        },
      };
      const result = evaluateMarketplaceStoreOrderEligibility(codOrder, {
        stage: "DISPATCH_CANDIDATE_SCAN",
      });
      expect(result.eligible).toBe(true);
    });

    it("strictly rejects CANCELLED, RECONCILIATION_REQUIRED, and PENDING_STORE_REVIEW commercial status", () => {
      for (const status of ["CANCELLED", "RECONCILIATION_REQUIRED", "PENDING_STORE_REVIEW"]) {
        for (const isCod of [false, true]) {
          const order = { ...baseValidStoreOrder, status };
          const result = evaluateMarketplaceStoreOrderEligibility(order, {
            stage: "OFFER_ASSIGNMENT",
            isCod,
          });
          expect(result.eligible).toBe(false);
          expect(result.code).toBe("STORE_ORDER_STATUS_INELIGIBLE");
        }
      }
    });
  });

  describe("Store Acceptance Status Dimensions", () => {
    it("rejects unaccepted store orders across all non-ACCEPTED statuses", () => {
      const nonAcceptedStatuses = [
        "PENDING_STORE_REVIEW",
        "REVIEWING",
        "CUSTOMER_ACTION_REQUIRED",
        "REJECTED",
        "TIMED_OUT",
      ];
      for (const acceptanceStatus of nonAcceptedStatuses) {
        const order = { ...baseValidStoreOrder, acceptanceStatus };
        const result = evaluateMarketplaceStoreOrderEligibility(order, { stage: "COURIER_ORDER_CREATION" });
        expect(result.eligible).toBe(false);
        expect(result.code).toBe("STORE_ORDER_NOT_ACCEPTED");
      }
    });
  });

  describe("Cancellation Request Dimensions", () => {
    it("rejects store orders with open REQUESTED, APPROVED, or RECONCILIATION_REQUIRED cancellation requests", () => {
      for (const status of ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"]) {
        const order: MarketplaceStoreOrderEligibilityCandidate = {
          ...baseValidStoreOrder,
          cancellationRequests: [{ id: "cr-1", status }],
        };
        const result = evaluateMarketplaceStoreOrderEligibility(order, { stage: "OFFER_ASSIGNMENT" });
        expect(result.eligible).toBe(false);
        expect(result.code).toBe("STORE_ORDER_CANCELLATION_PENDING");
      }
    });

    it("rejects store orders at DRIVER_ACCEPTANCE stage when cancellation request exists", () => {
      const order: MarketplaceStoreOrderEligibilityCandidate = {
        ...baseValidStoreOrder,
        cancellationRequests: [{ id: "cr-1", status: "REQUESTED" }],
      };
      const result = evaluateMarketplaceStoreOrderEligibility(order, { stage: "DRIVER_ACCEPTANCE" });
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("STORE_ORDER_CANCELLATION_PENDING");
    });

    it("permits store orders whose cancellation requests are REJECTED or null", () => {
      const orderRejected: MarketplaceStoreOrderEligibilityCandidate = {
        ...baseValidStoreOrder,
        cancellationRequests: [{ id: "cr-1", status: "REJECTED" }],
      };
      expect(
        evaluateMarketplaceStoreOrderEligibility(orderRejected, { stage: "OFFER_ASSIGNMENT" }).eligible
      ).toBe(true);

      const orderNull: MarketplaceStoreOrderEligibilityCandidate = {
        ...baseValidStoreOrder,
        cancellationRequests: null,
      };
      expect(
        evaluateMarketplaceStoreOrderEligibility(orderNull, { stage: "OFFER_ASSIGNMENT" }).eligible
      ).toBe(true);
    });
  });

  describe("Operational and Financial Resolution Dimensions", () => {
    it("rejects unresolved operational issues or pending adjustments/refunds", () => {
      const blockingResolutions = [
        "ISSUE_OPEN",
        "ADJUSTMENT_PENDING",
        "REFUND_PENDING",
        "RECONCILIATION_REQUIRED",
      ];
      for (const resolutionStatus of blockingResolutions) {
        const order = { ...baseValidStoreOrder, resolutionStatus };
        const result = evaluateMarketplaceStoreOrderEligibility(order, { stage: "DISPATCH_CANDIDATE_SCAN" });
        expect(result.eligible).toBe(false);
        expect(result.code).toBe("STORE_ORDER_RESOLUTION_BLOCKED");
      }
    });

    it("permits CLEAR and RESOLVED operational resolution statuses", () => {
      for (const resolutionStatus of ["CLEAR", "RESOLVED"]) {
        const order = { ...baseValidStoreOrder, resolutionStatus };
        expect(
          evaluateMarketplaceStoreOrderEligibility(order, { stage: "DISPATCH_CANDIDATE_SCAN" }).eligible
        ).toBe(true);
      }
    });

    it("rejects in-flight financial resolutions", () => {
      const blockingFinancialResolutions = [
        "ADJUSTMENT_CALCULATED",
        "REVERSAL_PENDING",
        "REFUND_RESERVED",
        "REFUND_PROCESSING",
        "RECONCILIATION_REQUIRED",
      ];
      for (const financialResolutionStatus of blockingFinancialResolutions) {
        const order = { ...baseValidStoreOrder, financialResolutionStatus };
        const result = evaluateMarketplaceStoreOrderEligibility(order, { stage: "RECOVERY" });
        expect(result.eligible).toBe(false);
        expect(result.code).toBe("STORE_ORDER_FINANCIAL_RESOLUTION_BLOCKED");
      }
    });

    it("permits UNCHANGED and REFUND_COMPLETED financial resolution statuses", () => {
      for (const financialResolutionStatus of ["UNCHANGED", "REFUND_COMPLETED"]) {
        const order = { ...baseValidStoreOrder, financialResolutionStatus };
        expect(
          evaluateMarketplaceStoreOrderEligibility(order, { stage: "RECOVERY" }).eligible
        ).toBe(true);
      }
    });
  });

  describe("Preparation and Readiness Dimensions", () => {
    it("allows NOT_STARTED and PREPARING at COURIER_ORDER_CREATION stage but rejects ABORTED", () => {
      for (const preparationStatus of ["NOT_STARTED", "PREPARING", "READY_FOR_HANDOFF"]) {
        const order = { ...baseValidStoreOrder, preparationStatus };
        expect(
          evaluateMarketplaceStoreOrderEligibility(order, { stage: "COURIER_ORDER_CREATION" }).eligible
        ).toBe(true);
      }

      const orderAborted = { ...baseValidStoreOrder, preparationStatus: "ABORTED" };
      const result = evaluateMarketplaceStoreOrderEligibility(orderAborted, { stage: "COURIER_ORDER_CREATION" });
      expect(result.eligible).toBe(false);
      expect(result.code).toBe("STORE_ORDER_PREPARATION_INELIGIBLE");
    });

    it("requires READY_FOR_PICKUP or READY_FOR_HANDOFF at dispatch, offer, driver acceptance, and recovery stages", () => {
      const stages = ["OFFER_ASSIGNMENT", "DRIVER_ACCEPTANCE", "RECOVERY", "DISPATCH_CANDIDATE_SCAN"] as const;
      for (const stage of stages) {
        const orderReadyPickup = {
          ...baseValidStoreOrder,
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "PREPARING",
        };
        expect(
          evaluateMarketplaceStoreOrderEligibility(orderReadyPickup, { stage }).eligible
        ).toBe(true);

        const orderReadyHandoff = {
          ...baseValidStoreOrder,
          derivedStatus: "PREPARING",
          preparationStatus: "READY_FOR_HANDOFF",
        };
        expect(
          evaluateMarketplaceStoreOrderEligibility(orderReadyHandoff, { stage }).eligible
        ).toBe(true);

        const orderNotReady = {
          ...baseValidStoreOrder,
          derivedStatus: "PREPARING",
          preparationStatus: "PREPARING",
        };
        const result = evaluateMarketplaceStoreOrderEligibility(orderNotReady, { stage });
        expect(result.eligible).toBe(false);
        expect(result.code).toBe("STORE_ORDER_NOT_READY_FOR_DISPATCH");

        const orderAbortedDispatch = {
          ...baseValidStoreOrder,
          derivedStatus: "READY_FOR_PICKUP",
          preparationStatus: "ABORTED",
        };
        const resultAborted = evaluateMarketplaceStoreOrderEligibility(orderAbortedDispatch, { stage });
        expect(resultAborted.eligible).toBe(false);
        expect(resultAborted.code).toBe("STORE_ORDER_NOT_READY_FOR_DISPATCH");
      }
    });
  });

  describe("Database Filter Specification", () => {
    it("defines MARKETPLACE_STORE_ORDER_DISPATCH_ELIGIBLE_WHERE with fail-closed structure", () => {
      expect(MARKETPLACE_STORE_ORDER_DISPATCH_ELIGIBLE_WHERE).toEqual({
        acceptanceStatus: "ACCEPTED",
        status: { notIn: ["CANCELLED", "RECONCILIATION_REQUIRED", "PENDING_STORE_REVIEW"] },
        resolutionStatus: { in: ["CLEAR", "RESOLVED"] },
        financialResolutionStatus: { in: ["UNCHANGED", "REFUND_COMPLETED"] },
        OR: [
          { derivedStatus: "READY_FOR_PICKUP" },
          { preparationStatus: "READY_FOR_HANDOFF" },
        ],
        cancellationRequests: {
          none: {
            status: { in: ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"] },
          },
        },
        AND: [
          {
            OR: [
              { status: "SETTLED" },
              {
                status: "PENDING_SETTLEMENT",
                checkoutStoreGroup: {
                  paymentPlan: {
                    path: ["mode"],
                    equals: "DEPOSIT_PLUS_COD",
                  },
                },
              },
            ],
          },
        ],
      });
    });
  });
});
