import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ paymentFindFirst: vi.fn(), paymentFindUnique: vi.fn(), orderFindFirst: vi.fn(), resolve: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { payment: { findFirst: mocks.paymentFindFirst, findUnique: mocks.paymentFindUnique }, order: { findFirst: mocks.orderFindFirst } } }));
vi.mock("@/lib/services/payment-subject.service", () => ({ resolveOrderPaymentSubject: mocks.resolve }));
import { getCustomerPaymentPage, getCustomerPaymentStatus } from "@/lib/services/payment-customer-query.service";

const payment = { publicReference: "pay_abcdefghijklmnop", provider: "PAYFAST", status: "REQUIRES_ACTION", amount: new Prisma.Decimal("10.00"), updatedAt: new Date("2026-07-17T00:00:00Z"), order: { orderNumber: "KT-1" } };
beforeEach(() => { vi.clearAllMocks(); mocks.paymentFindFirst.mockResolvedValue(payment); });
describe("customer payment query service", () => {
  it("returns an owned safe status without internal IDs or provider material", async () => expect(await getCustomerPaymentStatus("payer", payment.publicReference)).toEqual({ publicReference: payment.publicReference, orderReference: "KT-1", amount: "10.00", currency: "ZAR", provider: "PAYFAST", status: "REQUIRES_ACTION", updatedAt: "2026-07-17T00:00:00.000Z" }));
  it("returns no visibility when ownership lookup misses", async () => { mocks.paymentFindFirst.mockResolvedValueOnce(null); expect(await getCustomerPaymentStatus("other", payment.publicReference)).toBeNull(); });
  it("derives an unprepared page amount from authoritative subject evidence", async () => {
    mocks.orderFindFirst.mockResolvedValue({ id: "order-id", orderNumber: "KT-1" }); mocks.paymentFindUnique.mockResolvedValue(null); mocks.resolve.mockResolvedValue({ amount: { toString: () => "10.00" } });
    expect(await getCustomerPaymentPage({ id: "payer", email: "payer@example.test" }, "KT-1")).toMatchObject({ amount: "10.00", payment: null });
  });
});
