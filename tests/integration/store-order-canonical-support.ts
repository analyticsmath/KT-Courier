import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { prisma } from "../../lib/db/prisma";
import { prepareStoreOrder, storeControl } from "../e2e/fixtures/store-order";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";
import { createHash, randomUUID } from "node:crypto";
import { beginStoreOrderReview, confirmStoreOrderLineAvailability, requestMarketplaceStoreOrderCancellation, updateStoreOrderSubstitutionPreference, createStoreOrderReconciliationCase, acceptMarketplaceStoreOrder, generateStoreOrderPickupChallenge, createMarketplaceDeliveryBridge, applyMarketplaceStoreOrderAdjustment } from "../../lib/store-orders/store-order.service";

export function canonicalStoreIntegration(domain: string) {
  describe(`store-order ${domain}: canonical PostgreSQL persistence`, () => {
    it("executes canonical verified payment and domain transitions without financial state fabrication", async () => {
      assertDisposablePaystackAcceptance();
      if (!process.env.E2E_BASE_URL) throw new Error("Canonical store integration requires the disposable HTTP app; run in the E2E runtime, never count discovery as execution.");
      const browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ baseURL: process.env.E2E_BASE_URL });
      const page = await context.newPage();
      try {
        const f = await prepareStoreOrder(page, `pg-store-${domain}`, 390);
        const owner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
        const customer = await prisma.user.findUniqueOrThrow({ where: { email: `e2e-paystack-pg-store-${domain}@ktcouriers.local` } });
        const foreign = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-checkout-other@ktcouriers.local" } });
        const command = () => { const operationId = randomUUID(); return { storeOrderReference: f.storeReference, actorUserId: owner.id, operationId, requestHash: createHash("sha256").update(operationId).digest("hex") }; };
        const baseline = await storeControl(f.storeReference);
        if (domain === "acceptance") {
          const input = command(); await beginStoreOrderReview(input);
          expect(await beginStoreOrderReview(input)).toMatchObject({ replayed: true });
          await expect(beginStoreOrderReview({ ...input, requestHash: "0".repeat(64) })).rejects.toMatchObject({ code: "STORE_ORDER_IDEMPOTENCY_CONFLICT" });
          expect(await prisma.marketplaceStoreOrderOperation.count({ where: { marketplaceStoreOrderId: f.order.storeOrders[0].id, operationId: input.operationId } })).toBe(1);
          expect(await prisma.marketplaceStoreOrderHistory.count({ where: { marketplaceStoreOrderId: f.order.storeOrders[0].id, operationId: input.operationId } })).toBe(1);
        } else if (domain === "inventory" || domain === "adjustment" || domain === "refund") {
          await confirmStoreOrderLineAvailability({ ...command(), orderLineId: baseline.lines[0].id, availableQuantity: 0 });
          const after = await storeControl(f.storeReference);
          expect(after.adjustments).toHaveLength(1); expect(after.stock).toEqual(baseline.stock);
          expect(after.resolutionStatus).toBe("ADJUSTMENT_PENDING");
          if (domain === "refund") {
            await expect(applyMarketplaceStoreOrderAdjustment({ ...command(), adjustmentReference: after.adjustments[0].publicReference })).rejects.toBeDefined();
            const uncertain = await storeControl(f.storeReference);
            expect(uncertain.financialResolutionStatus).toBe("RECONCILIATION_REQUIRED");
            expect(uncertain.payment.totalRefundedAmount).toBe(baseline.payment.totalRefundedAmount);
            expect(uncertain.adjustments[0].status).toBe("RECONCILIATION_REQUIRED");
          } else if (domain === "adjustment") {
            expect(after.adjustments[0].refundAmount).toBe("1500.00");
            const allocations = await prisma.marketplaceStoreOrderAdjustmentAllocation.findMany({ where: { adjustment: { publicReference: after.adjustments[0].publicReference } } });
            expect(allocations.length).toBeGreaterThan(0);
            const seller = allocations.find(row => row.allocationType === "SELLER_BASIS")!;
            const commission = allocations.find(row => row.allocationType === "COMMISSION")!;
            const earning = allocations.find(row => row.allocationType === "STORE_EARNING")!;
            expect(seller.amount.sub(commission.amount).equals(earning.amount)).toBe(true);
          }
        } else if (domain === "substitution") {
          const input = { ...command(), orderLineId: baseline.lines[0].id, customerUserId: customer.id, preference: "CONTACT_ME" as const };
          await updateStoreOrderSubstitutionPreference(input);
          await expect(updateStoreOrderSubstitutionPreference({ ...input, customerUserId: foreign.id })).rejects.toMatchObject({ code: "STORE_ORDER_CUSTOMER_ACCESS_DENIED" });
          expect(await updateStoreOrderSubstitutionPreference(input)).toMatchObject({ replayed: true });
          expect((await storeControl(f.storeReference)).lines[0].fulfilment.substitutionPreference).toBe("CONTACT_ME");
        } else if (domain === "handoff" || domain === "delivery-bridge") {
          if (domain === "handoff") await expect(generateStoreOrderPickupChallenge(command())).rejects.toMatchObject({ code: "STORE_ORDER_HANDOFF_NOT_READY" });
          else await expect(createMarketplaceDeliveryBridge(command())).rejects.toMatchObject({ code: "STORE_ORDER_DELIVERY_BRIDGE_INVALID" });
          expect(await storeControl(f.storeReference)).toEqual(baseline);
        } else if (domain === "reconciliation") {
          const input = { storeOrderReference: f.storeReference, operationId: randomUUID(), reasonCode: "DISPOSABLE_COHERENCE_RESCAN", safeSummary: "Synthetic coherence rescan" };
          await createStoreOrderReconciliationCase(input); await createStoreOrderReconciliationCase(input);
          const after = await storeControl(f.storeReference);
          expect(after.reconciliation).toHaveLength(1); expect(after.resolutionStatus).toBe("RECONCILIATION_REQUIRED");
          expect(after.history.filter(row => row.operationId === input.operationId)).toHaveLength(1);
        } else {
          await expect(acceptMarketplaceStoreOrder({ ...command(), preparationMinutes: 30, pickupInstructions: "Disposable pickup" })).rejects.toMatchObject({ code: "STORE_ORDER_AVAILABILITY_UNRESOLVED" });
          const input = { ...command(), requesterType: "CUSTOMER" as const, requesterUserId: customer.id, reasonCode: "CUSTOMER_CHANGED_MIND" };
          await requestMarketplaceStoreOrderCancellation(input);
          await expect(requestMarketplaceStoreOrderCancellation({ ...input, requesterUserId: foreign.id })).rejects.toMatchObject({ code: "STORE_ORDER_CUSTOMER_ACCESS_DENIED" });
          expect((await storeControl(f.storeReference)).payment).toEqual(baseline.payment);
        }
        const final = await storeControl(f.storeReference);
        expect(final.payment.status).toBe("SUCCEEDED");
        expect(final.stock.every(row => row.onHand === row.available + row.reserved && row.available >= 0 && row.reserved >= 0)).toBe(true);
        const journals = await prisma.ledgerJournal.findMany({ where: { correlationId: f.snapshot.payment.reference }, select: { totalDebits: true, totalCredits: true } });
        expect(journals.every(journal => journal.totalDebits.equals(journal.totalCredits))).toBe(true);
      } finally { await context.close(); await browser.close(); }
    }, 180_000);
  });
}
