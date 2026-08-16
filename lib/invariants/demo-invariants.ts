/**
 * Pure, authoritative invariant validator functions for KT Courier operational and demo data.
 * Used by automated regression suites and database verification scripts.
 */

export interface CodValidationInput {
  id?: string;
  publicReference: string;
  policyMode: "FULL_COD" | "DEPOSIT_PLUS_COD" | "DIGITAL";
  authoritativePayable: number | string;
  digitalRequired: number | string;
  digitalPaid: number | string;
  cashObligation: number | string;
  cashCollected: number | string;
  cashReconciled: number | string;
  status: "PENDING" | "COLLECTED" | "RECONCILED" | "FAILED";
  collectorDriverId?: string | null;
  collectionJournalId?: string | null;
  reconciliationJournalId?: string | null;
  reconciliationStatus?: string | null;
  reconciledAt?: Date | string | null;
  reconciliationActorId?: string | null;
  payments?: Array<{ id: string; status: string; amount: number | string }>;
}

export interface DriverValidationInput {
  driverProfileId: string;
  driverCode: string;
  status: string;
  onboardingStatus: string;
  vehicleStatus: string;
  assignedAt: Date | string;
  completedAt?: Date | string | null;
}

export interface ClaimValidationInput {
  claimReference: string;
  orderPolicyMode: "FULL_COD" | "DEPOSIT_PLUS_COD" | "DIGITAL";
  paymentSource: "CASH" | "DIGITAL" | "MIXED";
  claimStatus: string;
  remedyType?: string | null;
  remedyAmount?: number | string | null;
  paymentRefundId?: string | null;
  refundAmount?: number | string | null;
  refundStatus?: string | null;
  digitalPaidAmount?: number | string | null;
}

export interface ChronologicalValidationInput {
  userCreatedAt: Date | string | number;
  orderCreatedAt: Date | string | number;
  assignmentAssignedAt?: Date | string | number | null;
  assignmentCompletedAt?: Date | string | number | null;
  claimCreatedAt?: Date | string | number | null;
  remedyCreatedAt?: Date | string | number | null;
}

export interface InvariantResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates COD economics, split conservation, double-payment prevention, and journal linkages.
 */
export function validateCodEconomics(input: CodValidationInput): InvariantResult {
  const errors: string[] = [];
  const auth = Number(input.authoritativePayable);
  const digReq = Number(input.digitalRequired);
  const cashObl = Number(input.cashObligation);
  const cashCol = Number(input.cashCollected);
  const cashRec = Number(input.cashReconciled);

  // 1. Split conservation: digitalRequired + cashObligation == authoritativePayable
  if (Math.abs((digReq + cashObl) - auth) > 0.01) {
    errors.push(`Split conservation violated: digitalRequired (${digReq}) + cashObligation (${cashObl}) !== authoritativePayable (${auth})`);
  }

  // 2. Policy-specific digital/cash constraints
  if (input.policyMode === "FULL_COD") {
    if (digReq !== 0) {
      errors.push(`FULL_COD requires digitalRequired === 0, got ${digReq}`);
    }
    if (Math.abs(cashObl - auth) > 0.01) {
      errors.push(`FULL_COD requires cashObligation (${cashObl}) === authoritativePayable (${auth})`);
    }

    // No succeeded digital payments allowed for FULL_COD
    if (input.payments) {
      const succeededDigital = input.payments.find((p) => p.status === "SUCCEEDED" && Number(p.amount) > 0);
      if (succeededDigital) {
        errors.push(`FULL_COD order has forbidden succeeded digital payment (${succeededDigital.amount})`);
      }
    }
  } else if (input.policyMode === "DEPOSIT_PLUS_COD") {
    if (digReq <= 0 || digReq >= auth) {
      errors.push(`DEPOSIT_PLUS_COD requires 0 < digitalRequired (${digReq}) < authoritativePayable (${auth})`);
    }
    if (cashObl <= 0 || cashObl >= auth) {
      errors.push(`DEPOSIT_PLUS_COD requires 0 < cashObligation (${cashObl}) < authoritativePayable (${auth})`);
    }
  }

  // 3. Reconciled row completeness
  if (input.status === "RECONCILED") {
    if (Math.abs(cashCol - cashObl) > 0.01) {
      errors.push(`RECONCILED status requires cashCollected (${cashCol}) === cashObligation (${cashObl})`);
    }
    if (Math.abs(cashRec - cashObl) > 0.01) {
      errors.push(`RECONCILED status requires cashReconciled (${cashRec}) === cashObligation (${cashObl})`);
    }
    if (!input.collectionJournalId) {
      errors.push("RECONCILED status requires non-null collectionJournalId");
    }
    if (!input.reconciliationJournalId) {
      errors.push("RECONCILED status requires non-null reconciliationJournalId");
    }
    if (!input.reconciledAt) {
      errors.push("RECONCILED status requires non-null reconciledAt");
    }
    if (!input.reconciliationActorId) {
      errors.push("RECONCILED status requires non-null reconciliationActorId");
    }
    if (!input.collectorDriverId) {
      errors.push("RECONCILED status requires non-null collectorDriverId");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates that driver assignments are granted exclusively to active, approved, and vehicle-compliant drivers.
 */
export function validateDriverAssignmentEligibility(input: DriverValidationInput): InvariantResult {
  const errors: string[] = [];

  if (input.status !== "ACTIVE") {
    errors.push(`Assignment given to non-active driver (${input.driverCode}): status is ${input.status}`);
  }
  if (input.onboardingStatus !== "APPROVED") {
    errors.push(`Assignment given to unapproved driver (${input.driverCode}): onboardingStatus is ${input.onboardingStatus}`);
  }
  if (input.vehicleStatus !== "APPROVED") {
    errors.push(`Assignment given to driver without compliant vehicle (${input.driverCode}): vehicleStatus is ${input.vehicleStatus}`);
  }

  if (input.completedAt) {
    const assignedTime = new Date(input.assignedAt).getTime();
    const completedTime = new Date(input.completedAt).getTime();
    if (completedTime < assignedTime) {
      errors.push(`Assignment completedAt (${input.completedAt}) cannot precede assignedAt (${input.assignedAt})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates claims classification and remedy refund linkages.
 */
export function validateClaimRemedyConsistency(input: ClaimValidationInput): InvariantResult {
  const errors: string[] = [];

  // 1. Payment source classification agreement with order policy
  if (input.orderPolicyMode === "DEPOSIT_PLUS_COD" && input.paymentSource !== "MIXED") {
    errors.push(`DEPOSIT_PLUS_COD order claim must have paymentSource MIXED, got ${input.paymentSource}`);
  }
  if (input.orderPolicyMode === "FULL_COD" && input.paymentSource !== "CASH") {
    errors.push(`FULL_COD order claim must have paymentSource CASH, got ${input.paymentSource}`);
  }
  if (input.orderPolicyMode === "DIGITAL" && input.paymentSource !== "DIGITAL") {
    errors.push(`DIGITAL order claim must have paymentSource DIGITAL, got ${input.paymentSource}`);
  }

  // 2. Remedy refund consistency
  if (input.claimStatus === "DECIDED" && input.remedyType === "PARTIAL_REFUND") {
    if (input.paymentSource === "CASH") {
      errors.push("CASH claims cannot receive partial digital refund remedies without financial backing");
    }
    if (!input.paymentRefundId) {
      errors.push("PARTIAL_REFUND remedy must link to a valid paymentRefundId");
    }
    if (input.refundAmount != null && input.digitalPaidAmount != null) {
      if (Number(input.refundAmount) > Number(input.digitalPaidAmount)) {
        errors.push(`Refund amount (${input.refundAmount}) exceeds digital paid amount (${input.digitalPaidAmount})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates monotonic chronological ordering across lifecycle events.
 */
export function validateChronologicalSequence(input: ChronologicalValidationInput): InvariantResult {
  const errors: string[] = [];
  const uTime = new Date(input.userCreatedAt).getTime();
  const oTime = new Date(input.orderCreatedAt).getTime();

  if (uTime > oTime) {
    errors.push(`User creation (${input.userCreatedAt}) cannot follow order creation (${input.orderCreatedAt})`);
  }

  if (input.assignmentAssignedAt) {
    const aTime = new Date(input.assignmentAssignedAt).getTime();
    if (oTime > aTime) {
      errors.push(`Order creation (${input.orderCreatedAt}) cannot follow assignment (${input.assignmentAssignedAt})`);
    }

    if (input.assignmentCompletedAt) {
      const cTime = new Date(input.assignmentCompletedAt).getTime();
      if (aTime > cTime) {
        errors.push(`Assignment (${input.assignmentAssignedAt}) cannot follow completion (${input.assignmentCompletedAt})`);
      }
    }
  }

  if (input.claimCreatedAt) {
    const clTime = new Date(input.claimCreatedAt).getTime();
    if (oTime > clTime) {
      errors.push(`Order creation (${input.orderCreatedAt}) cannot follow claim (${input.claimCreatedAt})`);
    }

    if (input.remedyCreatedAt) {
      const remTime = new Date(input.remedyCreatedAt).getTime();
      if (clTime > remTime) {
        errors.push(`Claim creation (${input.claimCreatedAt}) cannot follow remedy (${input.remedyCreatedAt})`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
