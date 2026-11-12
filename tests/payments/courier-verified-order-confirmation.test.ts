import { beforeEach, describe, expect, it, vi } from "vitest";
import { OrderStatus } from "@/types/db";

const readPayment = vi.hoisted(() => vi.fn());
const transition = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/courier-payment-readiness.service", () => ({
  getCourierPaymentReadiness: readPayment,
}));
vi.mock("@/lib/services/order-status.service", () => ({
  transitionOrderStatusInTx: transition,
}));
import { confirmVerifiedCourierOrderWithinTransaction } from "@/lib/services/courier-order-confirmation.service";

const payment = { subjectType: "COURIER_ORDER", orderId: "parcel-1", publicReference: "payment-1" };
const db = { order: { findUnique: vi.fn() } };

describe("provider-verified courier payment unlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.order.findUnique.mockResolvedValue({ status: OrderStatus.PENDING });
    readPayment.mockResolvedValue({ dispatchEligible: true, status: "PAID", paymentReference: "payment-1" });
    transition.mockResolvedValue(undefined);
  });

  it("confirms a pending parcel from its exact ledger-backed payment in the same transaction", async () => {
    await confirmVerifiedCourierOrderWithinTransaction(db as never, payment);
    expect(readPayment).toHaveBeenCalledWith("parcel-1", db);
    expect(transition).toHaveBeenCalledWith(db, expect.objectContaining({
      orderId: "parcel-1",
      fromStatus: OrderStatus.PENDING,
      toStatus: OrderStatus.CONFIRMED,
      actorRole: "SYSTEM",
      context: { isPaid: true },
    }));
  });

  it("allows a properly funded partial COD deposit to authorize confirmation", async () => {
    readPayment.mockResolvedValue({ dispatchEligible: true, status: "DEPOSIT_PAID_CASH_DUE", paymentReference: "payment-1" });
    await expect(confirmVerifiedCourierOrderWithinTransaction(db as never, payment)).resolves.toBeUndefined();
    expect(transition).toHaveBeenCalledTimes(1);
  });

  it("refuses unpaid, unposted, wrong-source or full-cash receipt evidence", async () => {
    for (const receipt of [
      { dispatchEligible: false, status: "PAYMENT_REQUIRED", paymentReference: null },
      { dispatchEligible: false, status: "RECONCILIATION_REQUIRED", paymentReference: "payment-1" },
      { dispatchEligible: true, status: "PAID", paymentReference: "other-payment" },
      { dispatchEligible: true, status: "CASH_DUE_ON_DELIVERY", paymentReference: null },
    ]) {
      readPayment.mockResolvedValue(receipt);
      await expect(confirmVerifiedCourierOrderWithinTransaction(db as never, payment))
        .rejects.toMatchObject({ code: "PAYMENT_INVALID_STATE" });
    }
    expect(transition).not.toHaveBeenCalled();
  });

  it("does not reactivate cancelled, failed or already completed deliveries", async () => {
    for (const status of [OrderStatus.CANCELLED, OrderStatus.FAILED, OrderStatus.DELIVERED, OrderStatus.CONFIRMED]) {
      db.order.findUnique.mockResolvedValue({ status });
      await confirmVerifiedCourierOrderWithinTransaction(db as never, payment);
    }
    expect(transition).not.toHaveBeenCalled();
  });

  it("does not change marketplace, subscription or advertising subjects", async () => {
    await confirmVerifiedCourierOrderWithinTransaction(db as never, { ...payment, subjectType: "MARKETPLACE_CHECKOUT" });
    expect(readPayment).not.toHaveBeenCalled();
    expect(db.order.findUnique).not.toHaveBeenCalled();
  });

  it("rejects an unlinked courier payment", async () => {
    await expect(confirmVerifiedCourierOrderWithinTransaction(db as never, { ...payment, orderId: null }))
      .rejects.toMatchObject({ code: "PAYMENT_ORDER_NOT_FOUND" });
  });
});
