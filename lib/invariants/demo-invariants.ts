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

export interface PrivateMediaValidationInput {
  publicReference: string;
  ownerType: string;
  ownerId: string;
  purpose: string;
  status: string;
  declaredMimeType?: string | null;
  detectedMimeType?: string | null;
  byteSize?: number | null;
  checksum?: string | null;
  linkedVehicleId?: string | null;
}

export interface OrderAssignmentValidationInput {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  currentDriverProfileId?: string | null;
  assignments: Array<{
    id?: string;
    driverProfileId: string;
    status: string;
    activeOrderGuard?: string | null;
    assignedAt?: Date | string | null;
    acceptedAt?: Date | string | null;
    completedAt?: Date | string | null;
  }>;
}

export interface RefundExecutionValidationInput {
  refundId: string;
  refundPublicReference: string;
  paymentId: string;
  paymentAmount: number | string;
  paymentTotalRefundedAmount: number | string;
  paymentTotalRefundReservedAmount: number | string;
  method: "ORIGINAL_PAYMENT_METHOD" | "CUSTOMER_WALLET";
  status: string;
  amount: number | string;
  customerUserId?: string | null;
  approvedByUserId?: string | null;
  completedByUserId?: string | null;
  reserveLedgerJournalId: string;
  completionLedgerJournalId?: string | null;
  currentAttemptId?: string | null;
  currentAttempt?: {
    id: string;
    refundId: string;
    status: string;
    providerRefundId?: string | null;
  } | null;
  fundingAllocations?: Array<{
    amount: number | string;
    sourceType?: string;
  }>;
  allPaymentRefunds?: Array<{
    id: string;
    amount: number | string;
    status: string;
  }>;
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

/**
 * Validates PrivateMediaObject ready evidence and vehicle ownership trigger constraints.
 */
export function validatePrivateMediaCompliance(input: PrivateMediaValidationInput): InvariantResult {
  const errors: string[] = [];

  // 1. Ready evidence check constraint: status == 'READY' => detectedMimeType, byteSize, checksum all non-null
  if (input.status === "READY") {
    if (!input.detectedMimeType || !input.detectedMimeType.trim()) {
      errors.push(`READY PrivateMediaObject (${input.publicReference}) requires non-null detectedMimeType`);
    }
    if (input.byteSize == null || input.byteSize <= 0) {
      errors.push(`READY PrivateMediaObject (${input.publicReference}) requires non-null positive byteSize`);
    }
    if (!input.checksum || !input.checksum.trim()) {
      errors.push(`READY PrivateMediaObject (${input.publicReference}) requires non-null checksum`);
    }
  }

  // 2. Vehicle document trigger constraint: linked to VehicleDocument/Media => ownerType === 'VEHICLE' && ownerId === linkedVehicleId
  if (input.linkedVehicleId) {
    if (input.ownerType !== "VEHICLE") {
      errors.push(`Vehicle-linked PrivateMediaObject (${input.publicReference}) requires ownerType === 'VEHICLE', got '${input.ownerType}'`);
    }
    if (input.ownerId !== input.linkedVehicleId) {
      errors.push(`Vehicle-linked PrivateMediaObject (${input.publicReference}) requires ownerId === '${input.linkedVehicleId}', got '${input.ownerId}'`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates Order.currentDriverProfileId pointer consistency and OrderAssignment activeOrderGuard invariants.
 */
export function validateOrderAssignmentPointerConsistency(input: OrderAssignmentValidationInput): InvariantResult {
  const errors: string[] = [];

  const acceptedAssignments = input.assignments.filter((a) => a.status === "ACCEPTED");

  // 1. At most one ACCEPTED assignment per order
  if (acceptedAssignments.length > 1) {
    errors.push(`Order ${input.orderNumber} has multiple (${acceptedAssignments.length}) ACCEPTED assignments`);
  }

  const accepted = acceptedAssignments[0];

  // 2. Pointer matching rule
  if (accepted) {
    if (!input.currentDriverProfileId) {
      errors.push(`Order ${input.orderNumber} has ACCEPTED assignment for driver ${accepted.driverProfileId} but currentDriverProfileId is null`);
    } else if (input.currentDriverProfileId !== accepted.driverProfileId) {
      errors.push(`Order ${input.orderNumber} currentDriverProfileId (${input.currentDriverProfileId}) does not match ACCEPTED assignment driver (${accepted.driverProfileId})`);
    }
  } else {
    if (input.currentDriverProfileId) {
      errors.push(`Order ${input.orderNumber} has currentDriverProfileId (${input.currentDriverProfileId}) but no ACCEPTED assignment`);
    }
  }

  // 3. activeOrderGuard rules for all assignments
  for (const a of input.assignments) {
    if (a.status === "ASSIGNED" || a.status === "ACCEPTED") {
      if (a.activeOrderGuard !== input.orderId) {
        errors.push(`Order ${input.orderNumber} assignment with status ${a.status} requires activeOrderGuard === '${input.orderId}', got '${a.activeOrderGuard}'`);
      }
    } else {
      // Terminal statuses
      if (a.activeOrderGuard != null) {
        errors.push(`Order ${input.orderNumber} assignment with terminal status ${a.status} requires activeOrderGuard === null, got '${a.activeOrderGuard}'`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates Phase 15 refund execution evidence, provider attempt linkage, and payment projection accounting.
 */
export function validateRefundExecutionEvidence(input: RefundExecutionValidationInput): InvariantResult {
  const errors: string[] = [];

  const payAmt = Number(input.paymentAmount);
  const payRefunded = Number(input.paymentTotalRefundedAmount);
  const payReserved = Number(input.paymentTotalRefundReservedAmount);

  // 1. Universal payment ceiling check
  if (payRefunded + payReserved > payAmt + 0.01) {
    errors.push(`Payment ${input.paymentId} refund projection (refunded ${payRefunded} + reserved ${payReserved}) exceeds captured amount (${payAmt})`);
  }

  // 2. Aggregate reconciliation if allPaymentRefunds provided
  if (input.allPaymentRefunds) {
    const expectedSucceeded = input.allPaymentRefunds
      .filter((r) => r.status === "SUCCEEDED")
      .reduce((sum, r) => sum + Number(r.amount), 0);
    const expectedReserved = input.allPaymentRefunds
      .filter((r) => ["REQUESTED", "UNDER_REVIEW", "APPROVED", "PROCESSING", "RECONCILIATION_REQUIRED"].includes(r.status))
      .reduce((sum, r) => sum + Number(r.amount), 0);

    if (Math.abs(expectedSucceeded - payRefunded) > 0.01) {
      errors.push(`Payment ${input.paymentId} totalRefundedAmount (${payRefunded}) disagrees with SUCCEEDED refunds sum (${expectedSucceeded})`);
    }
    if (Math.abs(expectedReserved - payReserved) > 0.01) {
      errors.push(`Payment ${input.paymentId} totalRefundReservedAmount (${payReserved}) disagrees with reserved refunds sum (${expectedReserved})`);
    }
  }

  // 3. SUCCEEDED refund requirements
  if (input.status === "SUCCEEDED") {
    if (!input.completionLedgerJournalId) {
      errors.push(`SUCCEEDED refund ${input.refundPublicReference} lacks completionLedgerJournalId`);
    }

    if (input.method === "ORIGINAL_PAYMENT_METHOD") {
      if (!input.currentAttemptId) {
        errors.push(`ORIGINAL_PAYMENT_METHOD SUCCEEDED refund ${input.refundPublicReference} lacks currentAttemptId`);
      } else if (!input.currentAttempt) {
        errors.push(`ORIGINAL_PAYMENT_METHOD SUCCEEDED refund ${input.refundPublicReference} has currentAttemptId (${input.currentAttemptId}) but attempt was not found`);
      } else {
        if (input.currentAttempt.id !== input.currentAttemptId) {
          errors.push(`Refund ${input.refundPublicReference} currentAttemptId mismatch (${input.currentAttemptId} vs ${input.currentAttempt.id})`);
        }
        if (input.currentAttempt.refundId !== input.refundId) {
          errors.push(`Refund ${input.refundPublicReference} current attempt belongs to another refund (${input.currentAttempt.refundId})`);
        }
        if (input.currentAttempt.status !== "SUCCEEDED") {
          errors.push(`Refund ${input.refundPublicReference} current attempt status is ${input.currentAttempt.status}, expected SUCCEEDED`);
        }
        if (!input.currentAttempt.providerRefundId || !input.currentAttempt.providerRefundId.trim()) {
          errors.push(`Refund ${input.refundPublicReference} successful provider attempt lacks providerRefundId`);
        }
      }
    } else if (input.method === "CUSTOMER_WALLET") {
      // Wallet refund: completion must NOT fabricate an external provider attempt
      if (input.currentAttemptId || input.currentAttempt) {
        errors.push(`CUSTOMER_WALLET refund ${input.refundPublicReference} must not have external provider attempt evidence`);
      }
    }

    // Dual-control validation for SUCCEEDED refunds
    if (!input.approvedByUserId) {
      errors.push(`SUCCEEDED refund ${input.refundPublicReference} lacks approvedByUserId`);
    }
    if (!input.completedByUserId) {
      errors.push(`SUCCEEDED refund ${input.refundPublicReference} lacks completedByUserId`);
    }
    if (input.approvedByUserId && input.completedByUserId && input.approvedByUserId === input.completedByUserId) {
      errors.push(`Refund ${input.refundPublicReference} violates dual-control: approver (${input.approvedByUserId}) cannot equal completer (${input.completedByUserId})`);
    }
    if (input.customerUserId && input.approvedByUserId && input.customerUserId === input.approvedByUserId) {
      errors.push(`Refund ${input.refundPublicReference} violates dual-control: customer (${input.customerUserId}) cannot approve refund`);
    }
    if (input.customerUserId && input.completedByUserId && input.customerUserId === input.completedByUserId) {
      errors.push(`Refund ${input.refundPublicReference} violates dual-control: customer (${input.customerUserId}) cannot complete refund`);
    }
  }

  // 4. Funding Allocation Sum Check (PaymentRefund_funding_sum invariant)
  if (input.fundingAllocations && input.fundingAllocations.length > 0) {
    const allocTotal = input.fundingAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const refundAmt = Number(input.amount);
    if (Math.abs(allocTotal - refundAmt) > 0.01) {
      errors.push(`Refund ${input.refundPublicReference} funding allocations sum (${allocTotal}) does not match refund amount (${refundAmt})`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface PaymentSuccessValidationInput {
  paymentId: string;
  paymentPublicReference: string;
  status: string;
  currency: string;
  successfulAttemptId?: string | null;
  successWebhookEventId?: string | null;
  successLedgerJournalId?: string | null;
  providerConfirmedAt?: Date | string | null;
  successfulAttempt?: {
    id: string;
    status: string;
    providerReference?: string | null;
  } | null;
  successWebhookEvent?: {
    id: string;
    processingStatus: string;
    signatureVerified: boolean;
    merchantVerified: boolean;
    amountVerified: boolean;
    providerDataVerified: boolean;
  } | null;
  successLedgerJournal?: {
    id: string;
    type: string;
    currency: string;
  } | null;
}

/**
 * Validates Phase 12 PayFast payment confirmation evidence, attempt completeness, webhook auditability, and ledger journal receipt.
 */
export function validatePaymentSuccessEvidence(input: PaymentSuccessValidationInput): InvariantResult {
  const errors: string[] = [];

  if (input.status === "SUCCEEDED") {
    if (input.currency !== "ZAR") {
      errors.push(`Payment ${input.paymentPublicReference} currency must be ZAR, got ${input.currency}`);
    }
    if (!input.providerConfirmedAt) {
      errors.push(`SUCCEEDED payment ${input.paymentPublicReference} lacks providerConfirmedAt`);
    }
    if (!input.successfulAttemptId) {
      errors.push(`SUCCEEDED payment ${input.paymentPublicReference} lacks successfulAttemptId`);
    } else if (input.successfulAttempt) {
      if (input.successfulAttempt.id !== input.successfulAttemptId) {
        errors.push(`Payment ${input.paymentPublicReference} successfulAttemptId mismatch`);
      }
      if (input.successfulAttempt.status !== "SUCCEEDED") {
        errors.push(`Payment ${input.paymentPublicReference} attempt status is ${input.successfulAttempt.status}, expected SUCCEEDED`);
      }
      if (!input.successfulAttempt.providerReference) {
        errors.push(`Payment ${input.paymentPublicReference} attempt lacks providerReference`);
      }
    }
    if (!input.successWebhookEventId) {
      errors.push(`SUCCEEDED payment ${input.paymentPublicReference} lacks successWebhookEventId`);
    } else if (input.successWebhookEvent) {
      if (input.successWebhookEvent.processingStatus !== "APPLIED") {
        errors.push(`Payment ${input.paymentPublicReference} webhook event status is ${input.successWebhookEvent.processingStatus}, expected APPLIED`);
      }
      if (!input.successWebhookEvent.signatureVerified || !input.successWebhookEvent.merchantVerified || !input.successWebhookEvent.amountVerified || !input.successWebhookEvent.providerDataVerified) {
        errors.push(`Payment ${input.paymentPublicReference} webhook event lacks verified flags`);
      }
    }
    if (!input.successLedgerJournalId) {
      errors.push(`SUCCEEDED payment ${input.paymentPublicReference} lacks successLedgerJournalId`);
    } else if (input.successLedgerJournal) {
      if (input.successLedgerJournal.type !== "EXTERNAL_PAYMENT_RECEIPT") {
        errors.push(`Payment ${input.paymentPublicReference} receipt journal type is ${input.successLedgerJournal.type}, expected EXTERNAL_PAYMENT_RECEIPT`);
      }
      if (input.successLedgerJournal.currency !== "ZAR") {
        errors.push(`Payment ${input.paymentPublicReference} receipt journal currency must be ZAR`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export interface Stage10PlusScenarioMapping {
  scenario: string;
  canonicalMigrationOrService: string;
  actor: string;
  requiredEvidence: string[];
  requiredParentChildRelationship: string;
  transactionBoundary: string;
  seedConstruction: string;
  verifierOrTest: string;
}

export const STAGE_10_PLUS_INVARIANT_MATRIX: Stage10PlusScenarioMapping[] = [
  {
    scenario: "PAYMENT_SUCCESS",
    canonicalMigrationOrService: "20260717040000_phase12_payfast_itn_reconciliation / payfast-ledger-posting-policy.ts",
    actor: "SYSTEM",
    requiredEvidence: ["PaymentAttempt (SUCCEEDED)", "PaymentWebhookEvent (APPLIED)", "EXTERNAL_PAYMENT_RECEIPT LedgerJournal"],
    requiredParentChildRelationship: "Payment -> successfulAttemptId, successWebhookEventId, successLedgerJournalId",
    transactionBoundary: "Interactive transaction or staged idempotency with atomic completion projection",
    seedConstruction: "seedPaymentWithEvidence() with actor: { kind: 'SYSTEM' }",
    verifierOrTest: "validatePaymentSuccessEvidence / Check 13 in verify-demo-db.ts",
  },
  {
    scenario: "EXTERNAL_REFUND",
    canonicalMigrationOrService: "20260717070000_phase15_customer_wallet_refunds / refund-request.service.ts / refund-dual-control.ts",
    actor: "Dual Control: financeApproverUserId (Finance Admin) != financeCompleterUserId (Finance Admin) != customerUserId",
    requiredEvidence: ["REFUND_RESERVE journal", "RefundFundingAllocation (sum == amount)", "RefundExecutionAttempt (SUCCEEDED)", "REFUND_EXTERNAL_PAYOUT journal", "RefundStatusHistory (4 transitions)"],
    requiredParentChildRelationship: "Claim -> ClaimRemedy -> PaymentRefund -> Payment (totalRefundedAmount projected)",
    transactionBoundary: "Single atomic interactive transaction (prisma.$transaction)",
    seedConstruction: "seedExternalRefundWithEvidence() using postLedgerJournalWithinTransaction",
    verifierOrTest: "validateRefundExecutionEvidence / Check 12 in verify-demo-db.ts",
  },
  {
    scenario: "COD_COLLECTION",
    canonicalMigrationOrService: "20260717040000_phase12_payfast_itn_reconciliation / phase_b_cod_cash_custody",
    actor: "assignedDriver.userId (ACTIVE eligible driver)",
    requiredEvidence: ["COD_COLLECTED_AT_DELIVERY event", "Driver custody debit entry", "Customer funds held credit entry"],
    requiredParentChildRelationship: "Order (DELIVERED) -> CashOnDelivery -> CashOnDeliveryEvent",
    transactionBoundary: "Committed at order delivery completion",
    seedConstruction: "postLedgerJournal with assignedDriver.userId",
    verifierOrTest: "validateCodEconomics / Check 7 in verify-demo-db.ts",
  },
  {
    scenario: "COD_DEPOSIT",
    canonicalMigrationOrService: "phase_b_cod_cash_custody / ledger-posting.service.ts",
    actor: "assignedDriver.userId / financeAdmin.id",
    requiredEvidence: ["COD custody transfer journal", "Driver custody credit", "Clearing/deposit debit"],
    requiredParentChildRelationship: "CashOnDelivery -> DriverWallet -> LedgerAccount",
    transactionBoundary: "Atomic ledger transfer",
    seedConstruction: "Balanced double-entry journal",
    verifierOrTest: "Universal double-entry balance / Check 8 in verify-demo-db.ts",
  },
  {
    scenario: "COD_RECONCILIATION",
    canonicalMigrationOrService: "phase_b_cod_cash_custody / cash-on-delivery.service.ts",
    actor: "superAdmin.id / financeAdmin.id (ACTIVE Admin)",
    requiredEvidence: ["COD_RECONCILED_WITH_FINANCE event", "Platform cash received debit", "Driver custody released credit"],
    requiredParentChildRelationship: "CashOnDelivery -> CashOnDeliveryEvent",
    transactionBoundary: "Atomic reconciliation posting",
    seedConstruction: "postLedgerJournal with superAdmin.id",
    verifierOrTest: "validateCodEconomics / Check 7 in verify-demo-db.ts",
  },
  {
    scenario: "CLAIM_REMEDY",
    canonicalMigrationOrService: "phase_b_claims_remedies / phase_b_claim_fulfilment_remedy_bridge",
    actor: "superAdmin.id (Decider) / customerId (Participant)",
    requiredEvidence: ["OrderClaim (DECIDED)", "ClaimRemedy (PARTIAL_REFUND)", "ClaimEvent (FILED, DECIDED)"],
    requiredParentChildRelationship: "Order -> OrderClaim -> ClaimRemedy -> PaymentRefund",
    transactionBoundary: "Remedy creation references atomic PaymentRefund",
    seedConstruction: "OrderClaim -> ClaimRemedy with amount consistency",
    verifierOrTest: "validateClaimEconomics / Check 4 in verify-demo-db.ts",
  },
  {
    scenario: "STORE_EARNING",
    canonicalMigrationOrService: "phase16_store_earnings / store-earning-accrual.service.ts",
    actor: "SYSTEM",
    requiredEvidence: ["StoreSettlementSnapshot", "StoreEarningAccrual", "Verified payment evidence (signature, merchant, amount, providerData verified)"],
    requiredParentChildRelationship: "Store -> StoreWallet -> StoreEarning",
    transactionBoundary: "Accrual calculation with snapshot verification",
    seedConstruction: "Verified payment record with APPLIED webhook",
    verifierOrTest: "Store settlement and earning integrity verification",
  },
  {
    scenario: "DRIVER_EARNING",
    canonicalMigrationOrService: "phase17_driver_earnings / driver-earning-accrual.service.ts",
    actor: "SYSTEM",
    requiredEvidence: ["DriverSettlementSnapshot", "DriverEarningAccrual", "DELIVERED order with accepted assignment"],
    requiredParentChildRelationship: "DriverProfile -> DriverWallet -> DriverEarning",
    transactionBoundary: "Accrual calculation on DELIVERED order",
    seedConstruction: "Delivered order with valid driver assignment pointer",
    verifierOrTest: "Driver settlement and earning integrity verification",
  },
  {
    scenario: "MARKETPLACE_PAYMENT",
    canonicalMigrationOrService: "phase21_marketplace_store_orders / marketplace-checkout.service.ts",
    actor: "SYSTEM (Receipt) / customerId (Cart & Checkout owner)",
    requiredEvidence: ["MarketplaceCart (CONVERTED)", "MarketplaceCheckout (COMPLETED)", "Payment (SUCCEEDED)", "MarketplaceOrder (CONFIRMED)", "MarketplaceStoreOrder (SETTLED)"],
    requiredParentChildRelationship: "Cart -> Checkout -> Payment -> MarketplaceOrder -> CheckoutStoreGroup -> MarketplaceStoreOrder",
    transactionBoundary: "Multi-store order creation and payment linking",
    seedConstruction: "seedPaymentWithEvidence for MARKETPLACE_CHECKOUT subject",
    verifierOrTest: "Marketplace order and payment integrity verification",
  },
  {
    scenario: "PROMOTER_ACCRUAL",
    canonicalMigrationOrService: "phase25_promoter_programme / promoter-accrual.service.ts",
    actor: "SYSTEM",
    requiredEvidence: ["PromoterProfile", "PromoterAccount", "Referral qualification snapshot"],
    requiredParentChildRelationship: "User -> PromoterProfile -> PromoterAccount",
    transactionBoundary: "Accrual posting",
    seedConstruction: "Promoter accounts with valid status and profiles",
    verifierOrTest: "Promoter profile and account verification",
  },
  {
    scenario: "PROMOTER_DEPOSIT",
    canonicalMigrationOrService: "phase25_promoter_programme / promoter-deposit.service.ts",
    actor: "Finance Admin",
    requiredEvidence: ["PromoterDepositJournal", "PromoterWallet balance update"],
    requiredParentChildRelationship: "PromoterAccount -> PromoterWallet -> LedgerJournal",
    transactionBoundary: "Atomic ledger transfer",
    seedConstruction: "Promoter balance ledger account",
    verifierOrTest: "Universal double-entry balance verification",
  },
  {
    scenario: "MANAGED_MARKETING_COMMERCIAL",
    canonicalMigrationOrService: "phase24_managed_marketing / managed-marketing.service.ts",
    actor: "s.ownerUserId (Store Owner Requester) / superAdmin.id (Package Creator)",
    requiredEvidence: ["ManagedMarketingPackageVersion (ACTIVE)", "ManagedMarketingPackageChannel", "ManagedMarketingRequest (DRAFT/SUBMITTED/RUNNING/COMPLETED)", "Price & tax snapshot"],
    requiredParentChildRelationship: "Store -> ManagedMarketingRequest -> ManagedMarketingPackageVersion -> ManagedMarketingChannelDefinition",
    transactionBoundary: "Request creation with package and channel relations",
    seedConstruction: "ManagedMarketingRequest with accurate price/tax snapshots",
    verifierOrTest: "Managed marketing package & request verification",
  },
  {
    scenario: "MANAGED_MARKETING_REVENUE",
    canonicalMigrationOrService: "phase_b_managed_marketing_revenue_reporting / revenue-reporting.service.ts",
    actor: "superAdmin.id (Recorded By)",
    requiredEvidence: ["ManagedMarketingPerformanceRecord (impressions, clicks, conversions)", "ManagedMarketingRequestCreative (PrivateMedia attached)"],
    requiredParentChildRelationship: "ManagedMarketingRequest -> ManagedMarketingPerformanceRecord / ManagedMarketingRequestCreative",
    transactionBoundary: "Performance recording and creative linking",
    seedConstruction: "Performance records with actual telemetry and creative media",
    verifierOrTest: "Performance and creative media linkage verification",
  },
];
