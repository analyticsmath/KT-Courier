import type { Prisma } from "@prisma/client";
import { parseMarketplacePaymentPlan, type MarketplacePaymentPlan } from "@/lib/marketplace-checkout/payment-plan";

export class MarketplaceDispatchEligibilityError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MarketplaceDispatchEligibilityError";
  }
}

export type DispatchEligibilityStage =
  | "COURIER_ORDER_CREATION"
  | "DISPATCH_CANDIDATE_SCAN"
  | "OFFER_ASSIGNMENT"
  | "DRIVER_ACCEPTANCE"
  | "RECOVERY";

export interface MarketplaceStoreOrderEligibilityCandidate {
  id: string;
  publicReference?: string | null;
  status: string; // MarketplaceStoreOrderStatus
  acceptanceStatus: string; // StoreOrderAcceptanceStatus
  preparationStatus: string; // StoreOrderPreparationStatus
  derivedStatus?: string | null; // StoreOrderDerivedStatus
  resolutionStatus: string; // StoreOrderResolutionStatus
  financialResolutionStatus: string; // StoreOrderFinancialResolutionStatus
  operationalVersion?: number | null;
  cancellationRequests?: Array<{
    id?: string;
    status: string; // StoreOrderCancellationRequestStatus
  }> | null;
  checkoutStoreGroup?: {
    id?: string;
    paymentPlan?: unknown;
  } | null;
}

export interface EligibilityEvaluationResult {
  eligible: boolean;
  code?: string;
  message?: string;
}

/**
 * Authoritatively inspects and parses the checkoutStoreGroup payment plan.
 * Malformed or missing plans fail closed as non-COD / prepaid.
 */
export function resolveMarketplaceStoreOrderPaymentMode(storeOrder: {
  checkoutStoreGroup?: { id?: string; paymentPlan?: unknown } | null;
}): { isCod: boolean; paymentPlan: MarketplacePaymentPlan | null } {
  if (!storeOrder.checkoutStoreGroup?.paymentPlan) {
    return { isCod: false, paymentPlan: null };
  }
  try {
    const plan = parseMarketplacePaymentPlan(storeOrder.checkoutStoreGroup.paymentPlan);
    return { isCod: plan.mode === "DEPOSIT_PLUS_COD", paymentPlan: plan };
  } catch {
    return { isCod: false, paymentPlan: null };
  }
}

/**
 * Authoritative fail-closed eligibility contract for marketplace store orders
 * across all courier lifecycle phases:
 * 1. COURIER_ORDER_CREATION (Phase 21: canonical Order creation from frozen evidence)
 * 2. DISPATCH_CANDIDATE_SCAN (Phase 7: automatic batch scan and ranking)
 * 3. OFFER_ASSIGNMENT (Phase 7.5: transactional driver offer creation)
 * 4. DRIVER_ACCEPTANCE (Phase 7.5: driver acceptance before assignment activation)
 * 5. RECOVERY (Authorized operator recovery of exhausted exception queue)
 */
export function evaluateMarketplaceStoreOrderEligibility(
  storeOrder: MarketplaceStoreOrderEligibilityCandidate,
  options: { stage: DispatchEligibilityStage; isCod?: boolean }
): EligibilityEvaluationResult {
  // 1. Acceptance status: must be explicitly ACCEPTED
  if (storeOrder.acceptanceStatus !== "ACCEPTED") {
    return {
      eligible: false,
      code: "STORE_ORDER_NOT_ACCEPTED",
      message: `Marketplace store order is not in ACCEPTED status (currently ${storeOrder.acceptanceStatus}).`,
    };
  }

  // 2. Cancellation requests: fail-closed if any open, requested, approved, or reconciling cancellation exists
  if (
    storeOrder.cancellationRequests &&
    storeOrder.cancellationRequests.some((r) =>
      ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"].includes(r.status)
    )
  ) {
    const blockingRequest = storeOrder.cancellationRequests.find((r) =>
      ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"].includes(r.status)
    );
    return {
      eligible: false,
      code: "STORE_ORDER_CANCELLATION_PENDING",
      message: `Marketplace store order has an active cancellation request in status ${blockingRequest?.status}.`,
    };
  }

  // 3. Operational resolution status: must be CLEAR or RESOLVED
  const resolutionStatus = storeOrder.resolutionStatus ?? "CLEAR";
  if (!["CLEAR", "RESOLVED"].includes(resolutionStatus)) {
    return {
      eligible: false,
      code: "STORE_ORDER_RESOLUTION_BLOCKED",
      message: `Marketplace store order resolutionStatus is ${resolutionStatus}; must be CLEAR or RESOLVED.`,
    };
  }

  // 4. Financial resolution status: must be UNCHANGED or REFUND_COMPLETED (no in-flight adjustments or refunds)
  const financialResolutionStatus = storeOrder.financialResolutionStatus ?? "UNCHANGED";
  if (!["UNCHANGED", "REFUND_COMPLETED"].includes(financialResolutionStatus)) {
    return {
      eligible: false,
      code: "STORE_ORDER_FINANCIAL_RESOLUTION_BLOCKED",
      message: `Marketplace store order financialResolutionStatus is ${financialResolutionStatus}; must be UNCHANGED or REFUND_COMPLETED.`,
    };
  }

  // 5. Commercial status & payment mode resolution:
  // Disallow CANCELLED, RECONCILIATION_REQUIRED, and PENDING_STORE_REVIEW
  if (["CANCELLED", "RECONCILIATION_REQUIRED", "PENDING_STORE_REVIEW"].includes(storeOrder.status)) {
    return {
      eligible: false,
      code: "STORE_ORDER_STATUS_INELIGIBLE",
      message: `Marketplace store order commercial status (${storeOrder.status}) is ineligible for dispatch operations.`,
    };
  }

  // Resolve payment mode from store order if not explicitly supplied
  const resolvedPayment = resolveMarketplaceStoreOrderPaymentMode(storeOrder);
  const isCod = options.isCod !== undefined ? options.isCod : resolvedPayment.isCod;

  if (!isCod) {
    // Prepaid orders strictly require SETTLED (no undocumented synonyms like CONFIRMED)
    if (storeOrder.status !== "SETTLED") {
      return {
        eligible: false,
        code: "STORE_ORDER_NOT_SETTLED",
        message: `Prepaid marketplace store order must be in SETTLED commercial status (currently ${storeOrder.status}).`,
      };
    }
  } else {
    // COD orders: require DEPOSIT_PLUS_COD plan and status PENDING_SETTLEMENT or SETTLED
    if (!["PENDING_SETTLEMENT", "SETTLED"].includes(storeOrder.status)) {
      return {
        eligible: false,
        code: "STORE_ORDER_COD_STATUS_INELIGIBLE",
        message: `COD marketplace store order must be in PENDING_SETTLEMENT or SETTLED commercial status (currently ${storeOrder.status}).`,
      };
    }
  }

  // 6. Preparation / Readiness checks
  if (options.stage === "COURIER_ORDER_CREATION") {
    if (
      storeOrder.preparationStatus === "ABORTED" ||
      !["NOT_STARTED", "PREPARING", "READY_FOR_HANDOFF"].includes(storeOrder.preparationStatus)
    ) {
      return {
        eligible: false,
        code: "STORE_ORDER_PREPARATION_INELIGIBLE",
        message: `Marketplace store order preparationStatus (${storeOrder.preparationStatus}) is not eligible for courier order creation.`,
      };
    }
  } else {
    // For DISPATCH_CANDIDATE_SCAN, OFFER_ASSIGNMENT, DRIVER_ACCEPTANCE, and RECOVERY:
    // Store order must be ready for handoff / pickup and never ABORTED
    const isReady =
      storeOrder.derivedStatus === "READY_FOR_PICKUP" ||
      storeOrder.preparationStatus === "READY_FOR_HANDOFF";

    if (storeOrder.preparationStatus === "ABORTED" || !isReady) {
      return {
        eligible: false,
        code: "STORE_ORDER_NOT_READY_FOR_DISPATCH",
        message: `Marketplace store order is not ready for pickup (derivedStatus: ${storeOrder.derivedStatus}, preparationStatus: ${storeOrder.preparationStatus}).`,
      };
    }
  }

  return { eligible: true };
}

/**
 * Asserts that a marketplace store order satisfies the canonical dispatch eligibility contract.
 * Throws MarketplaceDispatchEligibilityError if ineligible.
 */
export function assertMarketplaceStoreOrderEligibility(
  storeOrder: MarketplaceStoreOrderEligibilityCandidate,
  options: { stage: DispatchEligibilityStage; isCod?: boolean }
): void {
  const result = evaluateMarketplaceStoreOrderEligibility(storeOrder, options);
  if (!result.eligible) {
    throw new MarketplaceDispatchEligibilityError(
      result.code ?? "STORE_ORDER_INELIGIBLE",
      result.message ?? "Marketplace store order is not eligible for dispatch."
    );
  }
}

/**
 * Database WHERE filter fragment for Prisma to select only dispatch-eligible
 * MarketplaceStoreOrder records directly in the SQL engine.
 */
export const MARKETPLACE_STORE_ORDER_DISPATCH_ELIGIBLE_WHERE: Prisma.MarketplaceStoreOrderWhereInput = {
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
};

/**
 * Authoritative Prisma select projection ensuring all required eligibility fields,
 * payment plan, and cancellation requests are loaded in memory for revalidation.
 */
export const MARKETPLACE_STORE_ORDER_ELIGIBILITY_SELECT: Prisma.MarketplaceStoreOrderSelect = {
  id: true,
  publicReference: true,
  status: true,
  acceptanceStatus: true,
  preparationStatus: true,
  derivedStatus: true,
  resolutionStatus: true,
  financialResolutionStatus: true,
  operationalVersion: true,
  cancellationRequests: {
    where: {
      status: { in: ["REQUESTED", "APPROVED", "RECONCILIATION_REQUIRED"] },
    },
    select: {
      id: true,
      status: true,
    },
  },
  checkoutStoreGroup: {
    select: {
      id: true,
      paymentPlan: true,
    },
  },
};
