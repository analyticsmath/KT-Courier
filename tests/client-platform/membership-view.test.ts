import { beforeEach, describe, it, expect, vi } from "vitest";
import { Prisma } from "@prisma/client";
const db = vi.hoisted(() => ({
  subscriptionContract: { findMany: vi.fn() },
  subscriptionInvoice: { findMany: vi.fn() },
  subscriptionEntitlementGrant: { findMany: vi.fn() },
  subscriptionPlanVersion: { findMany: vi.fn() },
}));
const access = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db/prisma", () => ({ prisma: db }));
vi.mock("@/lib/client-platform/store-access", () => ({ storeAccess: access }));
import { businessMembershipView } from "@/lib/client-platform/membership-view.service";
beforeEach(() => {
  vi.resetAllMocks();
  access.mockResolvedValue({ store: { id: "actual-store" } });
  Object.values(db).forEach((m) => m.findMany.mockResolvedValue([]));
});
describe("business membership projection", () => {
  it("requires Finance and scopes contracts, invoices and grants to the actual business", async () => {
    const r = await businessMembershipView("employee");
    expect(access).toHaveBeenCalledWith("employee", "finance");
    expect(
      db.subscriptionContract.findMany.mock.calls[0][0].where.storeId,
    ).toBe("actual-store");
    expect(
      db.subscriptionInvoice.findMany.mock.calls[0][0].where.contract.storeId,
    ).toBe("actual-store");
    expect(
      db.subscriptionEntitlementGrant.findMany.mock.calls[0][0].where.storeId,
    ).toBe("actual-store");
    expect(r.canStartMembership).toBe(false);
  });
  it("only projects effective active store plans and exact invoice amounts", async () => {
    db.subscriptionInvoice.findMany.mockResolvedValue([
      {
        publicReference: "INV",
        invoiceNumber: "1",
        status: "PAID",
        currency: "ZAR",
        subtotal: new Prisma.Decimal("100.10"),
        taxAmount: new Prisma.Decimal("15.02"),
        total: new Prisma.Decimal("115.12"),
        issuedAt: new Date(),
        dueAt: new Date(),
        paidAt: null,
      },
    ]);
    const r = await businessMembershipView("employee");
    expect(r.invoices[0].total).toBe("115.12");
    const where = db.subscriptionPlanVersion.findMany.mock.calls[0][0].where;
    expect(where.program).toEqual({ subjectType: "STORE", status: "ACTIVE" });
    expect(where.status).toBe("ACTIVE");
    expect(where.AND).toHaveLength(2);
  });
  it("denies projections to employees without Finance access", async () => {
    access.mockRejectedValue(new Error("Denied"));
    await expect(businessMembershipView("employee")).rejects.toThrow("Denied");
    expect(db.subscriptionInvoice.findMany).not.toHaveBeenCalled();
  });
});
