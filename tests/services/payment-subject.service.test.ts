import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), access: vi.fn() }));
vi.mock("@/lib/client-platform/store-access", () => ({
  storeAccess: mocks.access,
}));
vi.mock("@/lib/db/prisma", () => ({
  prisma: { order: { findUnique: mocks.findUnique } },
}));
import { resolveOrderPaymentSubject } from "@/lib/services/payment-subject.service";

const order = {
  id: "o",
  orderNumber: "KT-9",
  customerId: "u",
  store: null,
  status: "CONFIRMED",
  currency: "ZAR",
  pricingQuoteId: "q",
  priceEstimate: new Prisma.Decimal("10.00"),
  pricingSubtotal: new Prisma.Decimal("8.70"),
  pricingTaxAmount: new Prisma.Decimal("1.30"),
  pricingTaxRate: new Prisma.Decimal("0.1500"),
  pricingSnapshot: { quoteId: "q", calculationVersion: "v1" },
  payments: [],
  pricingQuote: {
    id: "q",
    currency: "ZAR",
    calculationVersion: "v1",
    subtotal: new Prisma.Decimal("8.70"),
    taxAmount: new Prisma.Decimal("1.30"),
    taxRate: new Prisma.Decimal("0.1500"),
    total: new Prisma.Decimal("10.00"),
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(order);
});
describe("payment subject service", () => {
  it("returns exact Decimal-derived ZAR without mutation", async () => {
    const result = await resolveOrderPaymentSubject("o", "u");
    expect(result.amount.toString()).toBe("10.00");
    expect(mocks.findUnique).toHaveBeenCalledOnce();
  });
  it("rejects missing pricing evidence and already-paid orders", async () => {
    mocks.findUnique.mockResolvedValueOnce({ ...order, pricingSnapshot: null });
    await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({
      code: "PAYMENT_ORDER_NOT_PAYABLE",
    });
    mocks.findUnique.mockResolvedValueOnce({
      ...order,
      payments: [{ id: "p" }],
    });
    await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({
      code: "PAYMENT_ORDER_ALREADY_PAID",
    });
  });
});

describe("COD and delegated payment subjects", () => {
  const cod = {
    policyMode: "DEPOSIT_PLUS_COD",
    status: "PENDING",
    digitalPaid: new Prisma.Decimal(0),
    cashCollected: new Prisma.Decimal(0),
    authoritativePayable: new Prisma.Decimal(10),
    digitalRequired: new Prisma.Decimal(5),
    cashObligation: new Prisma.Decimal(5),
  };
  const split = {
    ...order,
    cashOnDelivery: cod,
    pricingSnapshot: {
      ...order.pricingSnapshot,
      paymentPolicy: {
        mode: "DEPOSIT_PLUS_COD",
        digitalRequired: "5.00",
        cashRequired: "5.00",
      },
    },
  };
  it("charges only the online deposit", async () => {
    mocks.findUnique.mockResolvedValue(split);
    expect((await resolveOrderPaymentSubject("o", "u")).amount.toString()).toBe(
      "5.00",
    );
  });
  it("rejects inconsistent payment splits", async () => {
    mocks.findUnique.mockResolvedValue({
      ...split,
      cashOnDelivery: { ...cod, digitalRequired: new Prisma.Decimal(6) },
    });
    await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({
      code: "PAYMENT_ORDER_NOT_PAYABLE",
    });
  });
  it("rejects cash-only orders from online preparation", async () => {
    mocks.findUnique.mockResolvedValue({
      ...split,
      cashOnDelivery: { ...cod, policyMode: "FULL_COD" },
    });
    await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({
      code: "PAYMENT_ORDER_NOT_PAYABLE",
    });
  });
  it("keeps the actual Finance employee as payer", async () => {
    mocks.findUnique.mockResolvedValue({
      ...order,
      customerId: null,
      storeId: "business",
      store: { ownerUserId: "owner" },
    });
    mocks.access.mockResolvedValue({ store: { id: "business" } });
    expect(
      (await resolveOrderPaymentSubject("o", "employee")).payerUserId,
    ).toBe("employee");
    expect(mocks.access).toHaveBeenCalledWith("employee", "finance");
  });
  it("denies employees without Finance access", async () => {
    mocks.findUnique.mockResolvedValue({
      ...order,
      customerId: null,
      storeId: "business",
      store: { ownerUserId: "owner" },
    });
    mocks.access.mockRejectedValue(Error("denied"));
    await expect(
      resolveOrderPaymentSubject("o", "employee"),
    ).rejects.toMatchObject({ code: "PAYMENT_PAYER_NOT_AUTHORIZED" });
  });
});
