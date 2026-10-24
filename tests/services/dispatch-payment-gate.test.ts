import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), eventCreate: vi.fn(),
  eligible: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { order: { findUnique: mocks.findUnique, findMany: mocks.findMany } },
}));
import { assertOrderAssignable, createAssignmentInTx } from "@/lib/services/assignments.service";

describe("dispatch financial authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue({ id: "order-1", orderNumber: "KT-2026-123456", status: "CONFIRMED", deliveryRegionId: "region-1" });
    mocks.findMany.mockResolvedValue([{ id: "order-1", cashOnDelivery: null, marketplaceStoreOrderBridge: null, payments: [] }]);
  });
  it("does not let an admin assign a digitally unpaid order", async () => {
    const result = await assertOrderAssignable("order-1");
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toMatch(/payment|ledger/i);
  });
  it("allows dispatch for a paid ledger-backed parcel", async () => {
    mocks.findMany.mockResolvedValue([{
      id: "order-1", cashOnDelivery: null, marketplaceStoreOrderBridge: null,
      payments: [{ publicReference: "pay_1", status: "SUCCEEDED", successLedgerJournalId: "journal-1", amount: { toFixed: () => "205.85" } }],
    }]);
    expect(await assertOrderAssignable("order-1")).toMatchObject({ ok: true });
  });
  it("denies direct assignment creation inside a transaction without confirmed funds", async () => {
    const tx = { order: { findMany: mocks.findMany }, orderAssignment: { create: mocks.create }, orderAssignmentEvent: { create: mocks.eventCreate } };
    await expect(createAssignmentInTx(tx as never, { orderId: "order-1", driverProfileId: "driver-1", assignedByAdminId: "admin-1" })).rejects.toThrow(/payment|ledger/i);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
