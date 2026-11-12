import { beforeEach, describe, expect, it, vi } from "vitest";

const payment = vi.hoisted(() => vi.fn());
vi.mock("@/lib/services/courier-payment-readiness.service", () => ({
  getCourierPaymentReadiness: payment,
}));
import { assertParcelDispatchFundingInTx } from "@/lib/services/dispatch-assignment.service";

describe("parcel dispatch transaction requires real financial authority", () => {
  beforeEach(() => payment.mockReset());

  it("rejects an unpaid or reconciliation-required parcel before it can be assigned", async () => {
    for (const status of ["PAYMENT_REQUIRED", "RECONCILIATION_REQUIRED"]) {
      payment.mockResolvedValue({ dispatchEligible: false, status });
      await expect(assertParcelDispatchFundingInTx({} as never, {
        id: "order-1", deliveryType: "PARCEL_DOCUMENT",
      })).rejects.toMatchObject({ code: expect.any(String) });
    }
    expect(payment).toHaveBeenCalledTimes(2);
  });

  it("accepts server-classified ledger-backed card or approved full COD while not labelling cash paid", async () => {
    for (const status of ["PAID", "DEPOSIT_PAID_CASH_DUE", "CASH_DUE_ON_DELIVERY"]) {
      payment.mockResolvedValue({ dispatchEligible: true, status });
      await expect(assertParcelDispatchFundingInTx({} as never, {
        id: "order-1", deliveryType: "PARCEL_DOCUMENT",
      })).resolves.toBeUndefined();
    }
  });

  it("does not impose a parcel-only guard on a non-parcel delivery", async () => {
    await expect(assertParcelDispatchFundingInTx({} as never, {
      id: "other-1", deliveryType: "SAME_DAY",
    })).resolves.toBeUndefined();
    expect(payment).not.toHaveBeenCalled();
  });
});
