import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { order: { findUnique: mocks.findUnique } } }));
import { resolveOrderPaymentSubject } from "@/lib/services/payment-subject.service";

const order = { id: "o", orderNumber: "KT-9", customerId: "u", store: null, status: "CONFIRMED", currency: "ZAR", pricingQuoteId: "q", priceEstimate: new Prisma.Decimal("10.00"), pricingSubtotal: new Prisma.Decimal("8.70"), pricingTaxAmount: new Prisma.Decimal("1.30"), pricingTaxRate: new Prisma.Decimal("0.1500"), pricingSnapshot: { quoteId: "q", calculationVersion: "v1" }, payments: [], pricingQuote: { id: "q", currency: "ZAR", calculationVersion: "v1", subtotal: new Prisma.Decimal("8.70"), taxAmount: new Prisma.Decimal("1.30"), taxRate: new Prisma.Decimal("0.1500"), total: new Prisma.Decimal("10.00") } };
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(order); });
describe("payment subject service", () => {
  it("returns exact Decimal-derived ZAR without mutation", async () => { const result = await resolveOrderPaymentSubject("o", "u"); expect(result.amount.toString()).toBe("10.00"); expect(mocks.findUnique).toHaveBeenCalledOnce(); });
  it("rejects missing pricing evidence and already-paid orders", async () => { mocks.findUnique.mockResolvedValueOnce({ ...order, pricingSnapshot: null }); await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({ code: "PAYMENT_ORDER_NOT_PAYABLE" }); mocks.findUnique.mockResolvedValueOnce({ ...order, payments: [{ id: "p" }] }); await expect(resolveOrderPaymentSubject("o", "u")).rejects.toMatchObject({ code: "PAYMENT_ORDER_ALREADY_PAID" }); });
});

