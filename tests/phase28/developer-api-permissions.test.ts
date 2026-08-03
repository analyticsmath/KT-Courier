import { describe, expect, it } from "vitest";
import { PERMISSIONS } from "@/lib/auth/permission-keys";

describe("Phase 28 developer permission authority", () => {
  it("defines each developer permission once and keeps approval/recovery duties distinct", () => {
    const entries = Object.entries(PERMISSIONS).filter(([key]) => key.startsWith("DEVELOPER_"));
    expect(new Set(entries.map(([, value]) => value)).size).toBe(entries.length);
    const values = new Set(entries.map(([, value]) => value));
    for (const required of ["DEVELOPER_APPLICATION_APPROVE", "DEVELOPER_APPLICATION_REVIEW", "DEVELOPER_SCOPE_MANAGE", "DEVELOPER_SCOPE_GRANT", "DEVELOPER_CREDENTIAL_AUDIT_READ", "DEVELOPER_CREDENTIAL_REVOKE", "DEVELOPER_WEBHOOK_DELIVERY_READ", "DEVELOPER_WEBHOOK_DELIVERY_RETRY", "DEVELOPER_RECONCILIATION_READ", "DEVELOPER_RECONCILIATION_RETRY"]) expect(values).toContain(PERMISSIONS[required as keyof typeof PERMISSIONS]);
    expect(PERMISSIONS.DEVELOPER_APPLICATION_APPROVE).not.toBe(PERMISSIONS.DEVELOPER_APPLICATION_REVIEW);
    expect(PERMISSIONS.DEVELOPER_SCOPE_MANAGE).not.toBe(PERMISSIONS.DEVELOPER_SCOPE_GRANT);
    expect(PERMISSIONS.DEVELOPER_WEBHOOK_DELIVERY_READ).not.toBe(PERMISSIONS.DEVELOPER_WEBHOOK_DELIVERY_RETRY);
  });
});
