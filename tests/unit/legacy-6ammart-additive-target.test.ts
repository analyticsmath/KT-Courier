import { describe, it, expect } from "vitest";
import { assertLegacyTargetOwnership } from "@/lib/migrations/legacy-6ammart/target-policy";

describe("approved additive legacy target", () => {
  it("allows exact retained identities alongside mapped imports", () => {
    expect(() => assertLegacyTargetOwnership(["existing", "imported"], ["imported"], "Store", ["existing"])).not.toThrow();
  });
  it("rejects a missing preserved row and an unreviewed replacement", () => {
    expect(() => assertLegacyTargetOwnership(["imported"], ["imported"], "Store", ["existing"])).toThrow();
    expect(() => assertLegacyTargetOwnership(["replacement", "imported"], ["imported"], "Store", ["existing"])).toThrow();
  });
  it("rejects adopting a retained store as importer-owned", () => {
    expect(() => assertLegacyTargetOwnership(["existing"], ["existing"], "Store", ["existing"])).toThrow(/overlap/);
  });
});
