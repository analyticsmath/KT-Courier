import { describe, it, expect } from "vitest";
import { REPORT_DEFINITIONS } from "@/lib/reporting/contracts";

describe("Phase 29 Reporting Policy Catalog", () => {
  it("must define report definitions with mandatory policies", () => {
    const definitions = Object.values(REPORT_DEFINITIONS);
    expect(definitions.length).toBeGreaterThan(5);

    for (const def of definitions) {
      expect(def.key).toBeDefined();
      expect(def.name).toBeDefined();
      expect(def.audience).toBeDefined();
      expect(def.requiredPermission).toBeDefined();
      expect(def.maximumRowCount).toBeGreaterThan(0);
      expect(["MINIMIZED", "ANONYMIZED", "FULL_AUDITED"]).toContain(def.piiPolicy);
      expect(def.currencyPolicy).toBe("ZAR_EXACT");
      expect(def.timezonePolicy).toBe("UTC");
    }
  });

  it("must prevent personal data leakage in public reports", () => {
    const customerOrderDef = REPORT_DEFINITIONS["customer-courier-orders"];
    expect(customerOrderDef).toBeDefined();
    expect(customerOrderDef.piiPolicy).toBe("MINIMIZED");
  });
});
