import { beforeEach, describe, expect, it, vi } from "vitest";

const transition = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: transition,
}));

import { recordWalletCourierConfirmationInTx } from "@/lib/services/wallet-spending.service";

describe("wallet-only parcel payment preserves state history", () => {
  const date = new Date("2026-11-12T10:00:00.000Z");
  beforeEach(() => vi.resetAllMocks());

  it("records a system-confirmed and auditable parcel transition with original journal", async () => {
    const db = { order: { update: vi.fn().mockResolvedValue({}) } };
    const input = {
      orderId: "parcel-1", orderStatus: "PENDING" as const, payerUserId: "customer-1",
      pricingSnapshot: { quoteId: "immutable-quote-1" },
      walletAmount: "85.00", journalId: "wallet-ledger-1", settledAt: date,
    };
    await recordWalletCourierConfirmationInTx(db as never, input);
    expect(transition).toHaveBeenCalledWith(db, {
      orderId: "parcel-1", fromStatus: "PENDING", toStatus: "CONFIRMED",
      actorRole: "SYSTEM", actorUserId: "customer-1",
      source: "wallet_funded_courier_order",
      note: expect.stringContaining("wallet balance"),
      context: { isPaid: true },
    });
    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: "parcel-1" },
      data: {
        pricingSnapshot: {
          quoteId: "immutable-quote-1",
          walletFunding: {
            walletAmount: "85.00", providerAmount: "0.00",
            journalId: "wallet-ledger-1", settledAt: date.toISOString(),
          },
        },
      },
    });
    expect(transition.mock.invocationCallOrder[0])
      .toBeLessThan(db.order.update.mock.invocationCallOrder[0]);
  });

  it("never writes a confirmed status when the state machine refuses a stale/terminal order", async () => {
    const db = { order: { update: vi.fn() } };
    transition.mockRejectedValue(new Error("Order is terminal."));
    await expect(recordWalletCourierConfirmationInTx(db as never, {
      orderId: "parcel-2", orderStatus: "CANCELLED",
      payerUserId: "customer-2", pricingSnapshot: null,
      walletAmount: "99.00", journalId: "j-2", settledAt: date,
    })).rejects.toThrow("Order is terminal.");
    expect(db.order.update).not.toHaveBeenCalled();
  });
});
