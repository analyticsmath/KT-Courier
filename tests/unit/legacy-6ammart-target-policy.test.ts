import { describe, it, expect } from "vitest";
import { assertLegacyApplyAllowed, assertLegacyTargetOwnership } from "@/lib/migrations/legacy-6ammart/target-policy";

describe("legacy migration target gate", () => {
  const staging = { DATABASE_URL: "postgresql://user:secret@isolated.internal/kt_legacy_staging", KT_DATABASE_CLASSIFICATION: "staging" };
  it("requires explicit classification before writes", () => {
    expect(() => assertLegacyApplyAllowed({ DATABASE_URL: staging.DATABASE_URL })).toThrow(/classification/);
    expect(() => assertLegacyApplyAllowed({ ...staging, KT_DATABASE_CLASSIFICATION: "unknown" })).toThrow(/classification/);
  });
  it("accepts an isolated staging target", () => expect(() => assertLegacyApplyAllowed(staging)).not.toThrow());
  it("requires production approval even when a staging flag is set", () => {
    for (const signal of [{ KT_DATABASE_CLASSIFICATION: "production" }, { RAILWAY_ENVIRONMENT_NAME: "production" }, { RAILWAY_PROJECT_NAME: "KT Courier Production" }, { DATABASE_URL: "postgresql://user:secret@db.internal/kt_courier_production" }]) {
      expect(() => assertLegacyApplyAllowed({ ...staging, ...signal })).toThrow(/cutover approval/);
    }
  });
  it("rejects a non-PostgreSQL target", () => expect(() => assertLegacyApplyAllowed({ ...staging, DATABASE_URL: "mysql://localhost/db" })).toThrow(/PostgreSQL/));
  it("accepts an empty target and an exact importer-owned rerun", () => {
    expect(() => assertLegacyTargetOwnership([], [], "Store")).not.toThrow();
    expect(() => assertLegacyTargetOwnership(["a", "b"], ["a", "b", "a"], "Store")).not.toThrow();
  });
  it("rejects unrelated replacement rows even when counts match", () => {
    expect(() => assertLegacyTargetOwnership(["a", "unrelated"], ["a", "b"], "Store")).toThrow(/unrelated or missing/);
    expect(() => assertLegacyTargetOwnership(["a"], [], "Store")).toThrow();
  });
});
