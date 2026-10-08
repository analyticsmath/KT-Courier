import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { rejectMarketplaceStoreOrder, requestMarketplaceStoreOrderCancellation, confirmStoreOrderLineAvailability, applyMarketplaceStoreOrderAdjustment, beginStoreOrderReview, acceptMarketplaceStoreOrder } from "@/lib/store-orders/store-order.service";
import { ExistingPhaseFinancialAdjustmentAuthority } from "@/lib/store-orders/financial-adjustment-composition";
import { assertDisposablePaystackAcceptance } from "@/lib/testing/disposable-paystack-policy";
import { createRefundRequest } from "@/lib/services/refund-request.service";
import { approveRefund } from "@/lib/services/refund-finance-review.service";
import { startProviderRefund } from "@/lib/services/refund-provider-execution.service";
import { RefundProviderRegistry } from "@/lib/refunds/providers/refund-provider-registry";
import { PaystackRefundAdapter } from "@/lib/refunds/providers/paystack/paystack-refund-adapter";
import { prepareStoreOrder, storeControl } from "../e2e/fixtures/store-order";
import { withCanonicalBrowser } from "./marketplace-canonical-support";
import { assertCanonicalRefundDatabase, CanonicalOfflineRefundClient, refundActors, protectedRefundState, assertJournalMoney } from "./refund-canonical-support";

describe("full unstarted cancellation with canonical payment, stock and refund evidence", () => {
  for (const scenario of ["rejection", "customer", "shortage"] as const) it(`composes ${scenario} from remaining frozen allocations and refunds the unearned fee once`, async () => {
    await withCanonicalBrowser(async page => {
      await assertCanonicalRefundDatabase();
      const f = await prepareStoreOrder(page, `pg-full-${scenario}`, 390);
      const actors = await refundActors();
      const owner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: f.snapshot.payment.id }, include: { successfulAttempt: true } });
      const orderId = f.order.storeOrders[0].id;
      const snapshot = await prisma.marketplaceSettlementSnapshot.findFirstOrThrow({ where: { marketplaceStoreOrderId: orderId } });
      const command = () => { const operationId = randomUUID(); return { storeOrderReference: f.storeReference, actorUserId: owner.id, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") }; };
      expect(snapshot.deliveryFeeResidual.greaterThan(0)).toBe(true);
      const before = await storeControl(f.storeReference);
      if (scenario === "shortage") await confirmStoreOrderLineAvailability({ ...command(), orderLineId: before.lines[0].id, availableQuantity: 0 });
      const action = command();
      if (scenario === "customer") {
        const input = { ...action, requesterType: "CUSTOMER" as const, requesterUserId: payment.userId!, reasonCode: "CUSTOMER_CHANGED_MIND" };
        await expect(requestMarketplaceStoreOrderCancellation({ ...input, requesterUserId: actors.foreign.id })).rejects.toMatchObject({ code: "STORE_ORDER_CUSTOMER_ACCESS_DENIED" });
        expect(await storeControl(f.storeReference)).toEqual(before);
        expect(await requestMarketplaceStoreOrderCancellation(input)).toMatchObject({ status: "APPROVED", adjustmentReference: expect.any(String) });
        expect(await requestMarketplaceStoreOrderCancellation(input)).toMatchObject({ replayed: true });
      } else {
        const input = { ...action, reasonCode: scenario === "shortage" ? "ALL_ITEMS_UNAVAILABLE" : "STORE_CLOSED" };
        await rejectMarketplaceStoreOrder(input); expect(await rejectMarketplaceStoreOrder(input)).toMatchObject({ replayed: true });
      }
      const after = await storeControl(f.storeReference);
      expect(after.preparationStatus).toBe("ABORTED"); expect(after.payment).toEqual(before.payment);
      const restoredBefore = before.stock.reduce((total, row) => total + row.onHand, 0);
      expect(after.stock.reduce((total, row) => total + row.onHand, 0)).toBe(restoredBefore + (scenario === "shortage" ? 0 : 1));
      expect(after.stock.every(row => row.available + row.reserved === row.onHand)).toBe(true);
      const adjustments = await prisma.marketplaceStoreOrderAdjustment.findMany({ where: { marketplaceStoreOrderId: orderId }, include: { allocations: true }, orderBy: { createdAt: "asc" } });
      expect(adjustments).toHaveLength(scenario === "shortage" ? 2 : 1);
      expect(adjustments.every(item => item.sourceVersion === snapshot.settlementVersion)).toBe(true);
      expect(adjustments.reduce((total, item) => total.add(item.refundAmount), new Prisma.Decimal(0)).equals(payment.amount)).toBe(true);
      const full = adjustments.find(item => ["FULL_STORE_REJECTION", "CUSTOMER_CANCELLATION"].includes(item.adjustmentType))!;
      expect(full.deliveryFeeAmount.equals(snapshot.deliveryFeeResidual)).toBe(true);
      for (const type of ["SELLER_BASIS", "COMMISSION", "STORE_EARNING"] as const) {
        const amount = adjustments.flatMap(item => item.allocations).filter(item => item.allocationType === type).reduce((total, item) => total.add(item.amount), new Prisma.Decimal(0));
        expect(amount.equals(type === "SELLER_BASIS" ? snapshot.sellerBasis : type === "COMMISSION" ? snapshot.commissionAmount : snapshot.storeEarningAmount)).toBe(true);
      }
      const client = new CanonicalOfflineRefundClient(payment.successfulAttempt!.providerReference!);
      const registry = new RefundProviderRegistry([new PaystackRefundAdapter(client)]);
      const dependencies = { assertProductionReady: () => assertDisposablePaystackAcceptance(), registry, providerRegistry: registry };
      for (const adjustment of adjustments) {
        const apply = { ...command(), adjustmentReference: adjustment.publicReference, dependencies: { financialAuthority: new ExistingPhaseFinancialAdjustmentAuthority(dependencies) } };
        const result = await applyMarketplaceStoreOrderAdjustment(apply);
        if (!("refundReference" in result) || typeof result.refundReference !== "string") throw Error("Canonical bound refund reference required.");
        expect((await applyMarketplaceStoreOrderAdjustment(apply)).replayed).toBe(true);
        const refund = await prisma.paymentRefund.findUniqueOrThrow({ where: { publicReference: result.refundReference }, include: { fundingAllocations: true, reserveLedgerJournal: { include: { entries: true } } } });
        expect(refund.fundingAllocations.every(item => item.sourceType === "CUSTOMER_FUNDS_HELD")).toBe(true);
        assertJournalMoney(refund.reserveLedgerJournal, "REFUND_RESERVE", adjustment.refundAmount.toFixed(2));
        await approveRefund({ actorUserId: actors.approver.id, publicReference: refund.publicReference, operationId: randomUUID() });
        await startProviderRefund({ actorUserId: actors.processor.id, publicReference: refund.publicReference, operationId: randomUUID() }, dependencies);
      }
      const final = await storeControl(f.storeReference);
      expect(final.stock).toEqual(after.stock); expect(final.resolutionStatus).toBe("RESOLVED"); expect(final.financialResolutionStatus).toBe("REFUND_COMPLETED");
      expect(final.adjustments.every(item => item.status === "COMPLETED")).toBe(true);
      if (scenario === "customer") expect(final.cancellations).toEqual([{ status: "APPLIED", operationId: action.operationId }]);
      const money = await protectedRefundState(payment.id);
      expect(money.payment.totalRefundedAmount.equals(payment.amount)).toBe(true); expect(money.payment.totalRefundReservedAmount.isZero()).toBe(true);
      expect(client.calls).toBe(adjustments.length);
      await expect(createRefundRequest({ actorUserId: payment.userId!, paymentPublicReference: payment.publicReference, amount: "0.01", method: "ORIGINAL_PAYMENT_METHOD", reasonCode: "SERVICE_NOT_PROVIDED", operationId: randomUUID() }, dependencies)).rejects.toMatchObject({ code: "REFUND_AMOUNT_EXCEEDS_REMAINING" });
      expect(await protectedRefundState(payment.id)).toEqual(money);
    });
  }, 180_000);

  it("keeps accepted cancellation pending review and preserves its courier and stock obligations", async () => {
    await withCanonicalBrowser(async page => {
      await assertCanonicalRefundDatabase(); const f = await prepareStoreOrder(page, "pg-full-earned-boundary", 390);
      const owner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
      const payment = await prisma.payment.findUniqueOrThrow({ where: { id: f.snapshot.payment.id } });
      const command = () => { const operationId = randomUUID(); return { storeOrderReference: f.storeReference, actorUserId: owner.id, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") }; };
      await beginStoreOrderReview(command()); await confirmStoreOrderLineAvailability({ ...command(), orderLineId: f.baseline.lines[0].id, availableQuantity: 1 });
      await acceptMarketplaceStoreOrder({ ...command(), preparationMinutes: 30, pickupInstructions: "Disposable policy boundary" });
      const before = await storeControl(f.storeReference);
      expect(await requestMarketplaceStoreOrderCancellation({ ...command(), requesterType: "CUSTOMER", requesterUserId: payment.userId!, reasonCode: "CUSTOMER_CHANGED_MIND" })).toMatchObject({ status: "REQUESTED", adjustmentReference: null });
      const after = await storeControl(f.storeReference); expect(after.stock).toEqual(before.stock); expect(after.payment).toEqual(before.payment); expect(after.adjustments).toEqual([]);
      expect(after.acceptanceStatus).toBe("ACCEPTED"); expect(after.preparationStatus).toBe("NOT_STARTED");
      await expect(rejectMarketplaceStoreOrder({ ...command(), reasonCode: "STORE_CLOSED" })).rejects.toMatchObject({ code: "STORE_ORDER_REJECTION_INVALID" });
    });
  }, 180_000);
});
