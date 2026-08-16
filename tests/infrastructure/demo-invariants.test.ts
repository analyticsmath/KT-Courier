import { describe, it, expect } from "vitest";
import {
  validateCodEconomics,
  validateDriverAssignmentEligibility,
  validateClaimRemedyConsistency,
  validateChronologicalSequence,
  validatePrivateMediaCompliance,
  validateOrderAssignmentPointerConsistency,
  validateRefundExecutionEvidence,
  CodValidationInput,
  DriverValidationInput,
  ClaimValidationInput,
  ChronologicalValidationInput,
  PrivateMediaValidationInput,
  OrderAssignmentValidationInput,
  RefundExecutionValidationInput,
} from "@/lib/invariants/demo-invariants";

describe("Extracted Invariant Engine & Operational Policies", () => {
  describe("validateCodEconomics", () => {
    it("validates a compliant FULL_COD record without digital payment", () => {
      const input: CodValidationInput = {
        publicReference: "COD-ORD-20250001",
        policyMode: "FULL_COD",
        authoritativePayable: 350.0,
        digitalRequired: 0,
        digitalPaid: 0,
        cashObligation: 350.0,
        cashCollected: 350.0,
        cashReconciled: 350.0,
        status: "RECONCILED",
        collectorDriverId: "drv-profile-01",
        collectionJournalId: "jnl-col-01",
        reconciliationJournalId: "jnl-rec-01",
        reconciliationStatus: "RECONCILED",
        reconciledAt: new Date(),
        reconciliationActorId: "admin-user-01",
        payments: [],
      };

      const result = validateCodEconomics(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects FULL_COD when digital double-payment is present", () => {
      const input: CodValidationInput = {
        publicReference: "COD-ORD-20250002",
        policyMode: "FULL_COD",
        authoritativePayable: 350.0,
        digitalRequired: 0,
        digitalPaid: 0,
        cashObligation: 350.0,
        cashCollected: 350.0,
        cashReconciled: 350.0,
        status: "RECONCILED",
        collectorDriverId: "drv-profile-01",
        collectionJournalId: "jnl-col-01",
        reconciliationJournalId: "jnl-rec-01",
        reconciledAt: new Date(),
        reconciliationActorId: "admin-user-01",
        payments: [{ id: "pay-01", status: "SUCCEEDED", amount: 350.0 }],
      };

      const result = validateCodEconomics(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("forbidden succeeded digital payment"))).toBe(true);
    });

    it("validates DEPOSIT_PLUS_COD split conservation", () => {
      const input: CodValidationInput = {
        publicReference: "COD-ORD-20250003",
        policyMode: "DEPOSIT_PLUS_COD",
        authoritativePayable: 500.0,
        digitalRequired: 100.0,
        digitalPaid: 100.0,
        cashObligation: 400.0,
        cashCollected: 400.0,
        cashReconciled: 400.0,
        status: "RECONCILED",
        collectorDriverId: "drv-profile-02",
        collectionJournalId: "jnl-col-02",
        reconciliationJournalId: "jnl-rec-02",
        reconciledAt: new Date(),
        reconciliationActorId: "admin-user-01",
        payments: [{ id: "pay-02", status: "SUCCEEDED", amount: 100.0 }],
      };

      const result = validateCodEconomics(input);
      expect(result.valid).toBe(true);
    });

    it("rejects COD record when split does not conserve total payable", () => {
      const input: CodValidationInput = {
        publicReference: "COD-ORD-20250004",
        policyMode: "DEPOSIT_PLUS_COD",
        authoritativePayable: 500.0,
        digitalRequired: 100.0,
        digitalPaid: 100.0,
        cashObligation: 350.0, // 100 + 350 = 450 != 500
        cashCollected: 350.0,
        cashReconciled: 350.0,
        status: "PENDING",
      };

      const result = validateCodEconomics(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Split conservation violated"))).toBe(true);
    });

    it("rejects RECONCILED row missing collection or reconciliation journals", () => {
      const input: CodValidationInput = {
        publicReference: "COD-ORD-20250005",
        policyMode: "FULL_COD",
        authoritativePayable: 200.0,
        digitalRequired: 0,
        digitalPaid: 0,
        cashObligation: 200.0,
        cashCollected: 200.0,
        cashReconciled: 200.0,
        status: "RECONCILED",
        collectorDriverId: "drv-profile-01",
        collectionJournalId: null, // Missing
        reconciliationJournalId: null, // Missing
        reconciledAt: null,
        reconciliationActorId: null,
      };

      const result = validateCodEconomics(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("collectionJournalId"))).toBe(true);
      expect(result.errors.some((e) => e.includes("reconciliationJournalId"))).toBe(true);
    });
  });

  describe("validateDriverAssignmentEligibility", () => {
    it("accepts active driver with approved onboarding and compliant vehicle", () => {
      const input: DriverValidationInput = {
        driverProfileId: "drv-01",
        driverCode: "DRV-1001",
        status: "ACTIVE",
        onboardingStatus: "APPROVED",
        vehicleStatus: "APPROVED",
        assignedAt: new Date("2025-08-01T10:00:00Z"),
        completedAt: new Date("2025-08-01T11:00:00Z"),
      };

      const result = validateDriverAssignmentEligibility(input);
      expect(result.valid).toBe(true);
    });

    it("rejects assignment given to suspended driver or pending vehicle", () => {
      const input: DriverValidationInput = {
        driverProfileId: "drv-02",
        driverCode: "DRV-1002",
        status: "SUSPENDED",
        onboardingStatus: "PENDING_REVIEW",
        vehicleStatus: "PENDING_REVIEW",
        assignedAt: new Date("2025-08-01T10:00:00Z"),
      };

      const result = validateDriverAssignmentEligibility(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(3);
    });
  });

  describe("validateClaimRemedyConsistency", () => {
    it("verifies MIXED paymentSource for DEPOSIT_PLUS_COD claims with partial digital refund", () => {
      const input: ClaimValidationInput = {
        claimReference: "CLM-001",
        orderPolicyMode: "DEPOSIT_PLUS_COD",
        paymentSource: "MIXED",
        claimStatus: "DECIDED",
        remedyType: "PARTIAL_REFUND",
        remedyAmount: 50.0,
        paymentRefundId: "prf-01",
        refundAmount: 50.0,
        refundStatus: "SUCCEEDED",
        digitalPaidAmount: 100.0,
      };

      const result = validateClaimRemedyConsistency(input);
      expect(result.valid).toBe(true);
    });

    it("rejects DEPOSIT_PLUS_COD claim classified as DIGITAL or CASH", () => {
      const input: ClaimValidationInput = {
        claimReference: "CLM-002",
        orderPolicyMode: "DEPOSIT_PLUS_COD",
        paymentSource: "DIGITAL", // Must be MIXED
        claimStatus: "DECIDED",
      };

      const result = validateClaimRemedyConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("must have paymentSource MIXED"))).toBe(true);
    });

    it("rejects CASH claim receiving digital partial refund remedy", () => {
      const input: ClaimValidationInput = {
        claimReference: "CLM-003",
        orderPolicyMode: "FULL_COD",
        paymentSource: "CASH",
        claimStatus: "DECIDED",
        remedyType: "PARTIAL_REFUND",
        paymentRefundId: "prf-fake",
      };

      const result = validateClaimRemedyConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("CASH claims cannot receive partial digital refund"))).toBe(true);
    });
  });

  describe("validateChronologicalSequence", () => {
    it("validates ordered lifecycle timestamps", () => {
      const input: ChronologicalValidationInput = {
        userCreatedAt: "2025-07-01T00:00:00Z",
        orderCreatedAt: "2025-08-01T10:00:00Z",
        assignmentAssignedAt: "2025-08-01T10:15:00Z",
        assignmentCompletedAt: "2025-08-01T11:30:00Z",
        claimCreatedAt: "2025-08-02T09:00:00Z",
        remedyCreatedAt: "2025-08-02T14:00:00Z",
      };

      const result = validateChronologicalSequence(input);
      expect(result.valid).toBe(true);
    });

    it("rejects non-monotonic sequence where order precedes user or remedy precedes claim", () => {
      const input: ChronologicalValidationInput = {
        userCreatedAt: "2025-08-05T00:00:00Z",
        orderCreatedAt: "2025-08-01T10:00:00Z", // Precedes user
        claimCreatedAt: "2025-08-03T10:00:00Z",
        remedyCreatedAt: "2025-08-02T10:00:00Z", // Precedes claim
      };

      const result = validateChronologicalSequence(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe("validatePrivateMediaCompliance", () => {
    it("validates compliant driver and vehicle private media objects", () => {
      const driverLicence: PrivateMediaValidationInput = {
        publicReference: "PMO-LIC-0001",
        ownerType: "DRIVER",
        ownerId: "drv-profile-01",
        purpose: "DRIVER_LICENCE",
        status: "READY",
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        byteSize: 245000,
        checksum: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      };
      expect(validatePrivateMediaCompliance(driverLicence).valid).toBe(true);

      const vehicleRegistration: PrivateMediaValidationInput = {
        publicReference: "PMO-VEH-0001",
        ownerType: "VEHICLE",
        ownerId: "veh-001",
        purpose: "VEHICLE_REGISTRATION",
        status: "READY",
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        byteSize: 185000,
        checksum: "ca978112ca1bbdcafac231b39a23dc4da78608141966ccd9ee4c32b50937a3f3",
        linkedVehicleId: "veh-001",
      };
      expect(validatePrivateMediaCompliance(vehicleRegistration).valid).toBe(true);
    });

    it("rejects READY private media missing detectedMimeType or byteSize or checksum", () => {
      const missingEvidence: PrivateMediaValidationInput = {
        publicReference: "PMO-LIC-0002",
        ownerType: "DRIVER",
        ownerId: "drv-profile-02",
        purpose: "DRIVER_LICENCE",
        status: "READY",
        declaredMimeType: "application/pdf",
        detectedMimeType: null, // Missing detectedMimeType
        byteSize: 245000,
        checksum: null, // Missing checksum
      };
      const result = validatePrivateMediaCompliance(missingEvidence);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("requires non-null detectedMimeType"))).toBe(true);
      expect(result.errors.some((e) => e.includes("requires non-null checksum"))).toBe(true);
    });

    it("rejects vehicle-linked private media where ownerType is not VEHICLE or ownerId does not match vehicleId", () => {
      const wrongOwner: PrivateMediaValidationInput = {
        publicReference: "PMO-VEH-0002",
        ownerType: "DRIVER", // Must be VEHICLE per trigger
        ownerId: "drv-profile-03", // Must be veh-002
        purpose: "VEHICLE_REGISTRATION",
        status: "READY",
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        byteSize: 185000,
        checksum: "ca978112ca1bbdcafac231b39a23dc4da78608141966ccd9ee4c32b50937a3f3",
        linkedVehicleId: "veh-002",
      };
      const result = validatePrivateMediaCompliance(wrongOwner);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("requires ownerType === 'VEHICLE'"))).toBe(true);
      expect(result.errors.some((e) => e.includes("requires ownerId === 'veh-002'"))).toBe(true);
    });
  });

  describe("validateOrderAssignmentPointerConsistency", () => {
    it("passes for ACCEPTED assignment with matching pointer and activeOrderGuard=orderId", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-001",
        orderNumber: "ORD-20250001",
        orderStatus: "IN_TRANSIT",
        currentDriverProfileId: "drv-001",
        assignments: [
          {
            driverProfileId: "drv-001",
            status: "ACCEPTED",
            activeOrderGuard: "ord-001",
            assignedAt: "2025-08-01T10:00:00Z",
            acceptedAt: "2025-08-01T10:05:00Z",
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("passes for COMPLETED assignment with null pointer and activeOrderGuard=null", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-002",
        orderNumber: "ORD-20250002",
        orderStatus: "DELIVERED",
        currentDriverProfileId: null,
        assignments: [
          {
            driverProfileId: "drv-002",
            status: "COMPLETED",
            activeOrderGuard: null,
            assignedAt: "2025-08-01T10:00:00Z",
            acceptedAt: "2025-08-01T10:05:00Z",
            completedAt: "2025-08-01T11:00:00Z",
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when pointer exists without ACCEPTED assignment", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-003",
        orderNumber: "ORD-20250003",
        orderStatus: "PENDING",
        currentDriverProfileId: "drv-003",
        assignments: [],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("has currentDriverProfileId (drv-003) but no ACCEPTED assignment"))).toBe(true);
    });

    it("fails when ACCEPTED driver differs from pointer", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-004",
        orderNumber: "ORD-20250004",
        orderStatus: "IN_TRANSIT",
        currentDriverProfileId: "drv-004-A",
        assignments: [
          {
            driverProfileId: "drv-004-B",
            status: "ACCEPTED",
            activeOrderGuard: "ord-004",
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("does not match ACCEPTED assignment driver"))).toBe(true);
    });

    it("fails when ACCEPTED assignment has null or wrong activeOrderGuard", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-005",
        orderNumber: "ORD-20250005",
        orderStatus: "IN_TRANSIT",
        currentDriverProfileId: "drv-005",
        assignments: [
          {
            driverProfileId: "drv-005",
            status: "ACCEPTED",
            activeOrderGuard: null, // Invalid: must be ord-005
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("requires activeOrderGuard === 'ord-005'"))).toBe(true);
    });

    it("fails when terminal assignment has non-null activeOrderGuard", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-006",
        orderNumber: "ORD-20250006",
        orderStatus: "DELIVERED",
        currentDriverProfileId: null,
        assignments: [
          {
            driverProfileId: "drv-006",
            status: "COMPLETED",
            activeOrderGuard: "ord-006", // Invalid: must be null for terminal status
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("requires activeOrderGuard === null"))).toBe(true);
    });

    it("fails when terminal-only assignment has non-null current-driver pointer", () => {
      const input: OrderAssignmentValidationInput = {
        orderId: "ord-007",
        orderNumber: "ORD-20250007",
        orderStatus: "DELIVERED",
        currentDriverProfileId: "drv-007", // Invalid: terminal orders must not leave a current driver pointer
        assignments: [
          {
            driverProfileId: "drv-007",
            status: "COMPLETED",
            activeOrderGuard: null,
          },
        ],
      };
      const result = validateOrderAssignmentPointerConsistency(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("has currentDriverProfileId (drv-007) but no ACCEPTED assignment"))).toBe(true);
    });
  });

  describe("validateRefundExecutionEvidence", () => {
    it("validates a compliant ORIGINAL_PAYMENT_METHOD SUCCEEDED refund with valid attempt and projection", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-001",
        refundPublicReference: "PRF-CLM-001",
        paymentId: "pay-001",
        paymentAmount: 500.0,
        paymentTotalRefundedAmount: 200.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 200.0,
        reserveLedgerJournalId: "jnl-res-001",
        completionLedgerJournalId: "jnl-comp-001",
        currentAttemptId: "att-001",
        currentAttempt: {
          id: "att-001",
          refundId: "ref-001",
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_12345",
        },
        allPaymentRefunds: [
          { id: "ref-001", amount: 200.0, status: "SUCCEEDED" },
        ],
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("validates a compliant CUSTOMER_WALLET SUCCEEDED refund with no external attempt", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-002",
        refundPublicReference: "PRF-CLM-002",
        paymentId: "pay-002",
        paymentAmount: 300.0,
        paymentTotalRefundedAmount: 150.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "CUSTOMER_WALLET",
        status: "SUCCEEDED",
        amount: 150.0,
        reserveLedgerJournalId: "jnl-res-002",
        completionLedgerJournalId: "jnl-comp-002",
        currentAttemptId: null,
        currentAttempt: null,
        allPaymentRefunds: [
          { id: "ref-002", amount: 150.0, status: "SUCCEEDED" },
        ],
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("fails when ORIGINAL_PAYMENT_METHOD SUCCEEDED refund lacks currentAttemptId", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-003",
        refundPublicReference: "PRF-CLM-003",
        paymentId: "pay-003",
        paymentAmount: 400.0,
        paymentTotalRefundedAmount: 100.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 100.0,
        reserveLedgerJournalId: "jnl-res-003",
        completionLedgerJournalId: "jnl-comp-003",
        currentAttemptId: null, // Invalid: missing attempt
        currentAttempt: null,
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("lacks currentAttemptId"))).toBe(true);
    });

    it("fails when current attempt belongs to another refund", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-004",
        refundPublicReference: "PRF-CLM-004",
        paymentId: "pay-004",
        paymentAmount: 400.0,
        paymentTotalRefundedAmount: 100.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 100.0,
        reserveLedgerJournalId: "jnl-res-004",
        completionLedgerJournalId: "jnl-comp-004",
        currentAttemptId: "att-foreign",
        currentAttempt: {
          id: "att-foreign",
          refundId: "ref-other-999", // Invalid: foreign refund
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_999",
        },
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("belongs to another refund"))).toBe(true);
    });

    it("fails when current attempt status is not SUCCEEDED", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-005",
        refundPublicReference: "PRF-CLM-005",
        paymentId: "pay-005",
        paymentAmount: 400.0,
        paymentTotalRefundedAmount: 100.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 100.0,
        reserveLedgerJournalId: "jnl-res-005",
        completionLedgerJournalId: "jnl-comp-005",
        currentAttemptId: "att-005",
        currentAttempt: {
          id: "att-005",
          refundId: "ref-005",
          status: "PROCESSING", // Invalid: attempt not succeeded
          providerRefundId: "pf_ref_005",
        },
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("expected SUCCEEDED"))).toBe(true);
    });

    it("fails when successful external attempt lacks providerRefundId", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-006",
        refundPublicReference: "PRF-CLM-006",
        paymentId: "pay-006",
        paymentAmount: 400.0,
        paymentTotalRefundedAmount: 100.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 100.0,
        reserveLedgerJournalId: "jnl-res-006",
        completionLedgerJournalId: "jnl-comp-006",
        currentAttemptId: "att-006",
        currentAttempt: {
          id: "att-006",
          refundId: "ref-006",
          status: "SUCCEEDED",
          providerRefundId: null, // Invalid: null provider refund id
        },
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("lacks providerRefundId"))).toBe(true);
    });

    it("fails when successful refund lacks completionLedgerJournalId", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-007",
        refundPublicReference: "PRF-CLM-007",
        paymentId: "pay-007",
        paymentAmount: 400.0,
        paymentTotalRefundedAmount: 100.0,
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 100.0,
        reserveLedgerJournalId: "jnl-res-007",
        completionLedgerJournalId: null, // Invalid: missing completion journal
        currentAttemptId: "att-007",
        currentAttempt: {
          id: "att-007",
          refundId: "ref-007",
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_007",
        },
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("lacks completionLedgerJournalId"))).toBe(true);
    });

    it("fails when successful refund remains counted in totalRefundReservedAmount", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-008",
        refundPublicReference: "PRF-CLM-008",
        paymentId: "pay-008",
        paymentAmount: 500.0,
        paymentTotalRefundedAmount: 200.0,
        paymentTotalRefundReservedAmount: 200.0, // Invalid: still counted in reserved projection
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 200.0,
        reserveLedgerJournalId: "jnl-res-008",
        completionLedgerJournalId: "jnl-comp-008",
        currentAttemptId: "att-008",
        currentAttempt: {
          id: "att-008",
          refundId: "ref-008",
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_008",
        },
        allPaymentRefunds: [
          { id: "ref-008", amount: 200.0, status: "SUCCEEDED" },
        ],
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("totalRefundReservedAmount (200) disagrees with reserved refunds sum (0)"))).toBe(true);
    });

    it("fails when Payment.totalRefundedAmount disagrees with successful refund totals", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-009",
        refundPublicReference: "PRF-CLM-009",
        paymentId: "pay-009",
        paymentAmount: 500.0,
        paymentTotalRefundedAmount: 100.0, // Invalid: disagrees with 200 sum
        paymentTotalRefundReservedAmount: 0.0,
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 200.0,
        reserveLedgerJournalId: "jnl-res-009",
        completionLedgerJournalId: "jnl-comp-009",
        currentAttemptId: "att-009",
        currentAttempt: {
          id: "att-009",
          refundId: "ref-009",
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_009",
        },
        allPaymentRefunds: [
          { id: "ref-009", amount: 200.0, status: "SUCCEEDED" },
        ],
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("totalRefundedAmount (100) disagrees with SUCCEEDED refunds sum (200)"))).toBe(true);
    });

    it("fails when reserved + refunded exceeds captured payment amount", () => {
      const input: RefundExecutionValidationInput = {
        refundId: "ref-010",
        refundPublicReference: "PRF-CLM-010",
        paymentId: "pay-010",
        paymentAmount: 300.0, // Payment amount is only 300
        paymentTotalRefundedAmount: 250.0,
        paymentTotalRefundReservedAmount: 100.0, // 250 + 100 = 350 > 300
        method: "ORIGINAL_PAYMENT_METHOD",
        status: "SUCCEEDED",
        amount: 250.0,
        reserveLedgerJournalId: "jnl-res-010",
        completionLedgerJournalId: "jnl-comp-010",
        currentAttemptId: "att-010",
        currentAttempt: {
          id: "att-010",
          refundId: "ref-010",
          status: "SUCCEEDED",
          providerRefundId: "pf_ref_010",
        },
      };
      const result = validateRefundExecutionEvidence(input);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("exceeds captured amount"))).toBe(true);
    });
  });
});
