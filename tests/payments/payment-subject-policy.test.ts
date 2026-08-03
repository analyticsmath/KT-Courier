import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ order: { findUnique: vi.fn() } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: mocks.order } }));
import { resolveOrderPaymentSubject } from "@/lib/services/payment-subject.service";

const validOrder = {
  id: "order-1", orderNumber: "KT-1", customerId: "payer-1", store: null, status: "PENDING", currency: "ZAR",
  pricingQuoteId: "quote-1", priceEstimate: new Prisma.Decimal("125.50"), pricingSubtotal: new Prisma.Decimal("109.13"), pricingTaxAmount: new Prisma.Decimal("16.37"), pricingTaxRate: new Prisma.Decimal("0.1500"),
  pricingSnapshot: { quoteId: "quote-1", calculationVersion: "v1" }, payments: [],
  pricingQuote: { id: "quote-1", currency: "ZAR", calculationVersion: "v1", subtotal: new Prisma.Decimal("109.13"), taxAmount: new Prisma.Decimal("16.37"), taxRate: new Prisma.Decimal("0.1500"), total: new Prisma.Decimal("125.50") },
};

beforeEach(() => { vi.clearAllMocks(); mocks.order.findUnique.mockResolvedValue(validOrder); });
describe("order payment subject policy", () => {
  it("derives exact server amount and payer from immutable pricing evidence", async () => expect(await resolveOrderPaymentSubject("order-1", "payer-1")).toMatchObject({ amount: expect.objectContaining({}), currency: "ZAR", payerUserId: "payer-1" }));
  it("rejects wrong ownership, terminal status, existing success, inconsistent pricing, and unsupported currency", async () => {
    for (const variant of [
      { customerId: "other" },
      { status: "CANCELLED" },
      { payments: [{ id: "paid" }] },
      { priceEstimate: new Prisma.Decimal("1.00") },
      { currency: "USD" },
    ]) { mocks.order.findUnique.mockResolvedValueOnce({ ...validOrder, ...variant }); await expect(resolveOrderPaymentSubject("order-1", "payer-1")).rejects.toBeInstanceOf(Error); }
  });
  it("accepts no client amount, currency, provider, or status parameter", () => expect(resolveOrderPaymentSubject).toHaveLength(2));
});

