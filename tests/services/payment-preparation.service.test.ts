import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LedgerMoney } from "@/lib/ledger/money";

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  prisma: { $transaction: vi.fn(), payment: { findUnique: vi.fn() } },
  tx: { payment: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() }, paymentStatusHistory: { create: vi.fn() } },
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/services/payment-subject.service", () => ({ resolveOrderPaymentSubject: mocks.resolve }));
import { prepareOrderPayment } from "@/lib/services/payment-preparation.service";

const row = { id: "p", publicReference: "pay_abcdefghijklmnop", userId: "u", orderId: "o", provider: null, status: "CREATED", amount: new Prisma.Decimal("10.00"), currency: "ZAR", creationRequestHash: "", version: 0, latestAttemptNumber: 0, expiresAt: null, succeededAt: null, failedAt: null, cancelledAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), order: { id: "o", orderNumber: "KT-1" }, user: { id: "u", name: "Payer" } };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ subjectType: "ORDER", subjectId: "o", orderReference: "KT-1", payerUserId: "u", currency: "ZAR", amount: LedgerMoney.parse("10.00"), description: "KT Couriers order KT-1", paymentAllowed: true, existingSuccessfulPaymentId: null });
  mocks.prisma.$transaction.mockImplementation(async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx));
  mocks.tx.payment.findUnique.mockResolvedValue(null); mocks.tx.payment.findFirst.mockResolvedValue(null);
  mocks.tx.payment.create.mockImplementation(async ({ data }: { data: { creationRequestHash: string } }) => ({ ...row, creationRequestHash: data.creationRequestHash }));
  mocks.tx.paymentStatusHistory.create.mockResolvedValue({ id: "h" });
});
describe("payment preparation service", () => {
  it("creates one CREATED payment and initial history from authoritative subject without attempts, ledger, or order mutation", async () => { const result = await prepareOrderPayment({ id: "u", email: "payer@example.test" }, { orderId: "o", idempotencyKey: "prepare:key:1" }); expect(result).toMatchObject({ id: "p", amount: "10.00", status: "CREATED" }); expect(mocks.tx.payment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ amount: expect.any(Prisma.Decimal), currency: "ZAR", provider: null }) })); expect(mocks.tx.paymentStatusHistory.create).toHaveBeenCalledOnce(); });
  it("replays a matching receipt and rejects changed-payload key reuse", async () => { mocks.tx.payment.findUnique.mockResolvedValueOnce({ ...row, creationRequestHash: "same" }); mocks.resolve.mockResolvedValueOnce({ ...(await mocks.resolve()), subjectId: "different" }); await expect(prepareOrderPayment({ id: "u", email: "payer@example.test" }, { orderId: "o", idempotencyKey: "prepare:key:1" })).rejects.toMatchObject({ code: "PAYMENT_IDEMPOTENCY_CONFLICT" }); });
  it("propagates transaction rollback failures", async () => { mocks.tx.paymentStatusHistory.create.mockRejectedValueOnce(new Error("rollback")); await expect(prepareOrderPayment({ id: "u", email: "payer@example.test" }, { orderId: "o", idempotencyKey: "prepare:key:2" })).rejects.toThrow("rollback"); });
});
