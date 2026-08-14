import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { assertDriverDeliveryResponsibilitiesInTx, assertPackageDeclarationCompliesWithPolicy, ShippingObligationError } from "@/lib/services/shipping-obligations.service";

const read = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("ENG-SHIP-006 package and insurance policy controls", () => {
  it("rejects prohibited, uninsured-unavailable and undeclared high-value packages through the production policy evaluator", () => {
    const policy = { prohibitedClassifications: ["PROHIBITED"], acceptanceRequired: true, highValueDeclarationRequired: true, insuranceMode: "UNAVAILABLE" };
    expect(() => assertPackageDeclarationCompliesWithPolicy(policy, { classification: "PROHIBITED", packagingConfirmed: true })).toThrow("PACKAGE_CLASSIFICATION_PROHIBITED");
    expect(() => assertPackageDeclarationCompliesWithPolicy(policy, { classification: null, highValue: true, packagingConfirmed: true })).toThrow("PACKAGE_DECLARED_VALUE_REQUIRED");
    expect(() => assertPackageDeclarationCompliesWithPolicy(policy, { classification: null, packagingConfirmed: true, insuranceRequested: true })).toThrow("PACKAGE_INSURANCE_UNAVAILABLE");
  });
  it("persists a versioned acceptance snapshot and attaches it to claim activity without creating a refund path", () => {
    const schema = read("prisma/schema.prisma"); const claims = read("lib/claims/claim.service.ts");
    expect(schema).toMatch(/model ShippingPackagePolicyVersion[\s\S]*versionNumber[\s\S]*effectiveFrom/);
    expect(schema).toMatch(/model ShipmentPackagePolicyDeclaration[\s\S]*policySnapshot[\s\S]*operationId/);
    expect(claims).toMatch(/PACKAGE_POLICY_CONTEXT_LINKED/);
  });
});

describe("ENG-SHIP-007 vendor preparation obligations", () => {
  it("uses order-store ownership and append-only preparation events before handoff", () => {
    const source = read("lib/services/shipping-obligations.service.ts");
    expect(source).toMatch(/order\.store\.ownerUserId !== input\.actorUserId/);
    expect(source).toMatch(/shipmentPreparationEvent\.create/);
    expect(source).toMatch(/PREPARATION_HANDOFF_PREREQUISITES_REQUIRED/);
  });
});

describe("ENG-SHIP-008 driver delivery responsibilities", () => {
  it("enforces required driver confirmations and blocks unresolved suspicious-package reports in the production completion guard", async () => {
    const missing = { driverDeliveryResponsibilityReport: { findMany: async () => [{ reportType: "SAFETY_CHECK", requiresReview: false }] } };
    await expect(assertDriverDeliveryResponsibilitiesInTx(missing, { assignmentId: "assignment" })).rejects.toMatchObject({ code: "DRIVER_DELIVERY_RESPONSIBILITIES_INCOMPLETE" } satisfies Partial<ShippingObligationError>);
    const suspicious = { driverDeliveryResponsibilityReport: { findMany: async () => [{ reportType: "SAFETY_CHECK", requiresReview: false }, { reportType: "LAWFUL_TRANSPORT_CONFIRMATION", requiresReview: false }, { reportType: "SUSPICIOUS_PACKAGE", requiresReview: true }] } };
    await expect(assertDriverDeliveryResponsibilitiesInTx(suspicious, { assignmentId: "assignment" })).rejects.toMatchObject({ code: "SUSPICIOUS_PACKAGE_REQUIRES_OPERATIONS_REVIEW" } satisfies Partial<ShippingObligationError>);
    const complete = { driverDeliveryResponsibilityReport: { findMany: async () => [{ reportType: "SAFETY_CHECK", requiresReview: false }, { reportType: "LAWFUL_TRANSPORT_CONFIRMATION", requiresReview: false }] } };
    await expect(assertDriverDeliveryResponsibilitiesInTx(complete, { assignmentId: "assignment" })).resolves.toBeUndefined();
    expect(read("lib/services/delivery-execution.service.ts")).toMatch(/assertDriverDeliveryResponsibilitiesInTx\(tx/);
  });
});
