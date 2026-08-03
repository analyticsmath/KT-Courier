import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_ADMIN_PERMISSION_KEYS, PERMISSIONS, ROLE_DEFAULT_PERMISSION_KEYS, SYSTEM_PERMISSION_DEFINITIONS } from "@/lib/auth/permission-keys";
import { UserRole } from "@/types/db";

describe("Phase 25 permission composition", () => {
  const phase25Keys = Object.entries(PERMISSIONS).filter(([name]) => name.startsWith("PROMOTER")).map(([, value]) => value);
  it("has unique Phase 25 permission keys and one definition per key", () => {
    expect(new Set(phase25Keys).size).toBe(phase25Keys.length);
    const definitions = SYSTEM_PERMISSION_DEFINITIONS.filter((definition) => phase25Keys.includes(definition.key));
    expect(definitions.length).toBe(phase25Keys.length);
    expect(new Set(definitions.map((definition) => definition.key)).size).toBe(definitions.length);
  });
  it("gives promoters only self-service defaults", () => {
    const promoterDefaults = ROLE_DEFAULT_PERMISSION_KEYS[UserRole.PROMOTER] ?? [];
    expect(promoterDefaults.length).toBeGreaterThan(0);
    expect(promoterDefaults.every((key) => key.startsWith("promoter_") || key.startsWith("promoter.") || key.includes("promoter"))).toBe(true);
    expect(promoterDefaults.some((key) => DEFAULT_ADMIN_PERMISSION_KEYS.includes(key))).toBe(false);
    expect(promoterDefaults).not.toContain(PERMISSIONS.PROMOTER_EARNINGS_READ);
  });
  it("keeps review, fraud, reconciliation, and finance authority separate", () => {
    expect(PERMISSIONS.PROMOTERS_REVIEW).not.toBe(PERMISSIONS.PROMOTER_FRAUD_MANAGE);
    expect(PERMISSIONS.PROMOTER_FRAUD_MANAGE).not.toBe(PERMISSIONS.PROMOTER_RECONCILIATION_MANAGE);
    expect(PERMISSIONS.PROMOTER_RECONCILIATION_MANAGE).not.toBe(PERMISSIONS.PROMOTER_EARNINGS_READ);
    expect(DEFAULT_ADMIN_PERMISSION_KEYS).toContain(PERMISSIONS.PROMOTER_FRAUD_MANAGE);
  });
  it("does not define forbidden manual finance, PII, or fraud bypass authority", () => {
    const forbidden = ["promoter_manual_attribution", "promoter_manual_qualification", "promoter_manual_earning", "promoter_manual_wallet_credit", "promoter_manual_withdrawal_complete", "promoter_bypass_fraud", "promoter_customer_pii_read"];
    expect([...phase25Keys, ...SYSTEM_PERMISSION_DEFINITIONS.map((definition) => definition.key)].some((key) => forbidden.includes(key))).toBe(false);
  });
  it("uses explicit DENY in the permission evaluator", () => {
    const source = readFileSync("lib/auth/permissions.ts", "utf8");
    expect(source.indexOf('override?.effect === PermissionEffect.DENY')).toBeGreaterThan(-1);
    expect(source.indexOf('override?.effect === PermissionEffect.DENY')).toBeLessThan(source.indexOf('override?.effect === PermissionEffect.ALLOW'));
  });
});
