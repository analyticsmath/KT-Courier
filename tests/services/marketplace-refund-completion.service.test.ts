import { Prisma } from "@prisma/client";
import { beforeEach, expect, it, vi } from "vitest";
import { projectMarketplaceRefundCompletion } from "@/lib/services/marketplace-refund-completion.service";
const f = vi.hoisted(() => ({ funding: vi.fn(), adjustments: vi.fn(), pending: vi.fn(), refund: vi.fn(), lock: vi.fn(), adjustmentUpdate: vi.fn(), issueUpdate: vi.fn(), adjustmentCount: vi.fn(), issueCount: vi.fn(), caseCount: vi.fn(), caseUpdate: vi.fn(), order: vi.fn(), orderUpdate: vi.fn(), history: vi.fn(), event: vi.fn() }));
vi.mock("@/lib/services/marketplace-adjustment-refund-authority", () => ({ assertCommittedMarketplaceAdjustmentFunding: f.funding }));
const tx = { $queryRaw: f.lock, marketplaceStoreOrderAdjustment: { findMany: (args: { where: { refundId?: string } }) => args.where.refundId ? f.adjustments(args) : f.pending(args), update: f.adjustmentUpdate, count: f.adjustmentCount }, paymentRefund: { findUnique: f.refund }, marketplaceStoreOrderIssue: { updateMany: f.issueUpdate, count: f.issueCount }, marketplaceStoreOrderReconciliationCase: { updateMany: f.caseUpdate, count: f.caseCount }, marketplaceStoreOrder: { findUniqueOrThrow: f.order, update: f.orderUpdate }, marketplaceStoreOrderHistory: { upsert: f.history }, marketplaceStoreOrderEventIntent: { upsert: f.event } } as unknown as Prisma.TransactionClient;
beforeEach(() => {
  vi.resetAllMocks();
  f.pending.mockResolvedValue([]);
  f.adjustments.mockResolvedValue([{ id: "adjustment", publicReference: "adjustment-ref", refundAmount: new Prisma.Decimal(10), financialEvidence: { issueReference: "owned-issue" }, storeOrder: { id: "order", marketplaceOrder: { paymentId: "payment", customerUserId: "customer" } } }]);
  f.refund.mockResolvedValue({ id: "refund", publicReference: "refund-ref", paymentId: "payment", customerUserId: "customer", amount: new Prisma.Decimal(10), status: "SUCCEEDED", completedAt: new Date(), completionLedgerJournal: { type: "REFUND_EXTERNAL_PAYOUT", totalDebits: new Prisma.Decimal(10), totalCredits: new Prisma.Decimal(10) } });
  f.adjustmentCount.mockResolvedValue(0); f.issueCount.mockResolvedValue(0); f.caseCount.mockResolvedValue(0); f.order.mockResolvedValue({ id: "order", acceptanceStatus: "REVIEWING", preparationStatus: "NOT_STARTED", deliveryBridgeStatus: "NOT_REQUESTED" });
});
it("projects a successful bound journal and only its original issue", async () => {
  await projectMarketplaceRefundCompletion(tx, "refund");
  expect(f.issueUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { marketplaceStoreOrderId: "order", publicReference: "owned-issue", status: "REFUND_PENDING" } }));
  expect(f.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolutionStatus: "RESOLVED", financialResolutionStatus: "REFUND_COMPLETED" }) }));
  expect(f.history).toHaveBeenCalledOnce(); expect(f.event).toHaveBeenCalledOnce();
});
it.each(["PROCESSING", "RECONCILIATION_REQUIRED"])("does not resolve from %s provider intent", async status => { const source = await f.refund(); source.status = status; await expect(projectMarketplaceRefundCompletion(tx, "refund")).rejects.toMatchObject({ code: "REFUND_LEDGER_INCOHERENT" }); expect(f.adjustmentUpdate).not.toHaveBeenCalled(); });
it("refuses another payment's otherwise balanced refund", async () => { const source = await f.refund(); source.paymentId = "foreign"; await expect(projectMarketplaceRefundCompletion(tx, "refund")).rejects.toMatchObject({ code: "REFUND_LEDGER_INCOHERENT" }); expect(f.adjustmentUpdate).not.toHaveBeenCalled(); });
it("refuses to project the same refund onto two adjustments", async () => { const rows = await f.adjustments(); f.adjustments.mockResolvedValue([...rows, { ...rows[0], id: "other" }]); await expect(projectMarketplaceRefundCompletion(tx, "refund")).rejects.toMatchObject({ code: "REFUND_LEDGER_INCOHERENT" }); expect(f.adjustmentUpdate).not.toHaveBeenCalled(); });
it("keeps unrelated open reconciliation authority", async () => { f.caseCount.mockResolvedValue(1); await projectMarketplaceRefundCompletion(tx, "refund"); expect(f.adjustmentUpdate).toHaveBeenCalledOnce(); expect(f.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolutionStatus: "RECONCILIATION_REQUIRED", financialResolutionStatus: "RECONCILIATION_REQUIRED" }) })); });
it("keeps a second approved adjustment actionable after the first refund completes", async () => { f.pending.mockResolvedValue([{ status: "APPROVED" }]); await projectMarketplaceRefundCompletion(tx, "refund"); expect(f.orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ resolutionStatus: "REFUND_PENDING", financialResolutionStatus: "ADJUSTMENT_CALCULATED" }) })); });
it("replay and ordinary refunds do not create store projection effects", async () => { f.adjustments.mockResolvedValue([]); await projectMarketplaceRefundCompletion(tx, "refund"); expect(f.refund).not.toHaveBeenCalled(); expect(f.history).not.toHaveBeenCalled(); });

it("revalidates the captured COD deposit before projecting its completed refund", async () => {
  const rows = await f.adjustments(); rows[0].financialEvidence.unstartedCodCancellation = { version: "unstarted-marketplace-cod-v1" };
  const refund = await f.refund(); refund.creationIdempotencyKey = "apply:refund";
  await projectMarketplaceRefundCompletion(tx, "refund");
  expect(f.funding).toHaveBeenCalledWith(tx, { adjustmentReference: "adjustment-ref", paymentId: "payment", customerUserId: "customer", operationId: "apply:refund", amount: "10.00" });
  expect(f.adjustmentUpdate).toHaveBeenCalledOnce();
});
it("leaves COD fulfilment unresolved when committed deposit authority fails", async () => {
  const rows = await f.adjustments(); rows[0].financialEvidence.unstartedCodCancellation = { version: "unstarted-marketplace-cod-v1" };
  f.funding.mockRejectedValue(new Error("Captured deposit is incoherent"));
  await expect(projectMarketplaceRefundCompletion(tx, "refund")).rejects.toThrow("Captured deposit is incoherent");
  expect(f.adjustmentUpdate).not.toHaveBeenCalled(); expect(f.orderUpdate).not.toHaveBeenCalled(); expect(f.event).not.toHaveBeenCalled();
});
