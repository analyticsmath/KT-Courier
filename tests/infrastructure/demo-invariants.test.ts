import { describe, it, expect } from "vitest";
import {
  validateCodEconomics,
  validateDriverAssignmentEligibility,
  validateClaimRemedyConsistency,
  validateChronologicalSequence,
  validatePrivateMediaCompliance,
  CodValidationInput,
  DriverValidationInput,
  ClaimValidationInput,
  ChronologicalValidationInput,
  PrivateMediaValidationInput,
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
});
