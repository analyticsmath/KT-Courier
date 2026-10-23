import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("order-scoped private POD administration", () => {
  it("shows custody evidence to operational admins with orders.read", () => {
    const page = readFileSync(new URL("../../app/(admin)/admin/orders/[id]/page.tsx", import.meta.url), "utf8");
    expect(page).toContain("listAdminDeliveryEvidence(id)");
    expect(page).toContain('title="Driver delivery evidence"');
    expect(page).not.toContain("canViewPrivateEvidence &&");
  });
  it("does not grant orders.read access to other private media", () => {
    const source = readFileSync(new URL("../../lib/private-media/private-media.service.ts", import.meta.url), "utf8");
    expect(source).toMatch(/ownerType === PrivateMediaOwnerType\.PROOF_OF_DELIVERY[\s\S]*?actor\.role === UserRole\.ADMIN[\s\S]*?PERMISSIONS\.ORDERS_READ/);
    expect(source).toContain("ownerType === PrivateMediaOwnerType.CLAIM");
    expect(source).toContain("PERMISSIONS.CLAIMS_INVESTIGATE");
  });
});
