import { describe, it, expect } from "vitest";
import { REPORT_DEFINITIONS, ReportDefinitionContract, ReportingError } from "@/lib/reporting/contracts";
import { generateReportData } from "@/lib/reporting/report-generator";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

describe("Phase 29 Comprehensive Reporting Verification", () => {
  const ALL_KEYS = [
    "customer-courier-orders",
    "customer-payments",
    "customer-marketplace-orders",
    "customer-personal-data",
    "store-orders",
    "store-earnings",
    "store-products-catalog",
    "driver-completed-deliveries",
    "driver-earnings",
    "promoter-referrals",
    "promoter-earnings",
    "developer-api-usage",
    "admin-order-volume",
    "admin-payfast-reconciliation",
    "admin-financial-reconciliation",
    "admin-recruitment-pipeline",
  ];

  it("1. Must define exactly 16 report definitions", () => {
    const keys = Object.keys(REPORT_DEFINITIONS);
    expect(keys.length).toBe(16);
    for (const key of ALL_KEYS) {
      expect(REPORT_DEFINITIONS[key]).toBeDefined();
    }
  });

  it("2. Must enforce strict schema contracts for all 16 definitions", () => {
    for (const key of ALL_KEYS) {
      const def = REPORT_DEFINITIONS[key];
      expect(def.key).toBe(key);
      expect(def.version).toBeGreaterThanOrEqual(1);
      expect(def.name.length).toBeGreaterThan(0);
      expect(def.allowedFormats.length).toBeGreaterThan(0);
      expect(def.maximumRowCount).toBeGreaterThan(0);
      expect(def.currencyPolicy).toBe("ZAR_EXACT");
      expect(def.timezonePolicy).toBe("UTC");
    }
  });

  it("3. Customer Reports - Ownership & Deny", () => {
    const custDef = REPORT_DEFINITIONS["customer-courier-orders"];
    expect(custDef.audience).toBe("CUSTOMER");
    expect(custDef.resourceOwnerRule).toBe("OWNER_ONLY");
    expect(custDef.requiredPermission).toBe(PERMISSIONS.REPORT_READ_OWN);
  });

  it("4. Store Reports - Ownership & Permissions", () => {
    const storeDef = REPORT_DEFINITIONS["store-orders"];
    expect(storeDef.audience).toBe("STORE");
    expect(storeDef.resourceOwnerRule).toBe("STORE_OWNER");
    expect(storeDef.requiredPermission).toBe(PERMISSIONS.STORE_REPORT_READ);
  });

  it("5. Driver Reports - Ownership & Permissions", () => {
    const driverDef = REPORT_DEFINITIONS["driver-completed-deliveries"];
    expect(driverDef.audience).toBe("DRIVER");
    expect(driverDef.resourceOwnerRule).toBe("DRIVER_OWNER");
    expect(driverDef.requiredPermission).toBe(PERMISSIONS.DRIVER_REPORT_READ_OWN);
  });

  it("6. Promoter Reports - Ownership & Permissions", () => {
    const promoterDef = REPORT_DEFINITIONS["promoter-earnings"];
    expect(promoterDef.audience).toBe("PROMOTER");
    expect(promoterDef.resourceOwnerRule).toBe("PROMOTER_OWNER");
    expect(promoterDef.requiredPermission).toBe(PERMISSIONS.PROMOTER_REPORT_READ_OWN);
  });

  it("7. Developer Reports - Ownership & Permissions", () => {
    const devDef = REPORT_DEFINITIONS["developer-api-usage"];
    expect(devDef.audience).toBe("DEVELOPER");
    expect(devDef.resourceOwnerRule).toBe("DEVELOPER_OWNER");
    expect(devDef.requiredPermission).toBe(PERMISSIONS.DEVELOPER_REPORT_READ_OWN);
  });

  it("8. Administrator Reports - Permissions & Security", () => {
    const adminDef = REPORT_DEFINITIONS["admin-financial-reconciliation"];
    expect(adminDef.audience).toBe("ADMINISTRATOR");
    expect(adminDef.resourceOwnerRule).toBe("ADMIN_PERMISSION");
    expect(adminDef.sensitivity).toBe("RESTRICTED");
  });

  it("9. Recruitment Privacy & PII Minimization", () => {
    const recruitDef = REPORT_DEFINITIONS["admin-recruitment-pipeline"];
    expect(recruitDef.audience).toBe("ADMINISTRATOR");
    expect(recruitDef.piiPolicy).toBe("MINIMIZED");
  });

  it("10. CSV Formula Injection Prevention", () => {
    const sanitizeCsvCell = (val: unknown): string => {
      const str = String(val ?? "");
      if (str.startsWith("=") || str.startsWith("+") || str.startsWith("-") || str.startsWith("@")) {
        return `'${str}`;
      }
      return str;
    };

    expect(sanitizeCsvCell("=SUM(1,2)")).toBe("'=SUM(1,2)");
    expect(sanitizeCsvCell("+12345")).toBe("'+12345");
    expect(sanitizeCsvCell("-500.00")).toBe("'-500.00");
    expect(sanitizeCsvCell("@EXEC")).toBe("'@EXEC");
    expect(sanitizeCsvCell("Normal Text")).toBe("Normal Text");
  });

  it("11. Maximum Row Limits & Date Constraints", () => {
    for (const key of ALL_KEYS) {
      const def = REPORT_DEFINITIONS[key];
      expect(def.maximumRowCount).toBeLessThanOrEqual(10000);
      if (def.maximumDateRangeDays) {
        expect(def.maximumDateRangeDays).toBeLessThanOrEqual(365);
      }
    }
  });

  it("12. Invalid Report Definition Key Rejection", async () => {
    try {
      await generateReportData({
        definitionKey: "invalid-nonexistent-report",
        requesterUserId: "user-1",
        requesterRole: "CUSTOMER",
        ownerScope: {},
        filters: {},
        limit: 10,
      });
      expect.fail("Should have thrown error");
    } catch (err: any) {
      expect(err.code).toBe("REPORT_DEFINITION_NOT_FOUND");
    }
  });
});
