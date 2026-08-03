import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ prisma: { $transaction: vi.fn(), payment: { count: vi.fn(), findMany: vi.fn(), findUnique: vi.fn() } } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: mocks.prisma }));
import { getPaymentDetail, listPaymentProviders, listPayments } from "@/lib/services/payment-query.service";
const payment = { id: "p", publicReference: "pay_ref", provider: "PAYFAST", status: "PROCESSING", amount: new Prisma.Decimal("10.00"), currency: "ZAR", version: 1, latestAttemptNumber: 1, expiresAt: null, succeededAt: null, failedAt: null, cancelledAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), order: { id: "o", orderNumber: "KT-1" }, user: { id: "u", name: null } };
beforeEach(() => { vi.clearAllMocks(); mocks.prisma.$transaction.mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations)); });
describe("payment query service", () => {
  it("returns stable pagination, sorting, safe payer summary, and money strings", async () => { mocks.prisma.payment.count.mockResolvedValue(1); mocks.prisma.payment.findMany.mockResolvedValue([payment]); const result = await listPayments({ page: 1, pageSize: 20 }); expect(result.data[0]).toMatchObject({ amount: "10.00", payer: { label: "Payer u" } }); expect(mocks.prisma.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ createdAt: "desc" }, { id: "desc" }] })); });
  it("omits hashes, keys, snapshots, and credentials from detail DTO", async () => { mocks.prisma.payment.findUnique.mockResolvedValue({ ...payment, creationRequestHash: "hidden", attempts: [], statusHistory: [] }); const result = await getPaymentDetail("p"); expect(JSON.stringify(result)).not.toMatch(/creationRequestHash|requestHash|Snapshot|secret|credential/); });
  it("returns known-but-unconfigured provider readiness", () => expect(listPaymentProviders().data[0]).toMatchObject({ code: "PAYFAST", configured: false }));
});

