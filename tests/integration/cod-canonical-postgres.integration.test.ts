import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { withCanonicalBrowser } from "./marketplace-canonical-support";
import { codBooking, codState, codTransit, verifyCodDeposit } from "./cod-canonical-support";
import { recordCashCollection, reconcileCashCollection, adjustCashOnDelivery, recordCashCollectionFailure } from "@/lib/services/cash-on-delivery.service";
import { createPricingQuote } from "@/lib/services/pricing-quote.service";
import { createOrder } from "@/lib/services/orders.service";
import { transitionOrderStatusInTx } from "@/lib/services/order-status.service";

describe("canonical offline 50/50 COD custody and shortage persistence", () => {
  for (const suffix of ["shortage", "zero"] as const) it(`retains ${suffix} remittance as a balanced suspense obligation with exact replay`, async () => {
    await withCanonicalBrowser(async page => {
      const f = await codBooking(page, suffix); await verifyCodDeposit(page, f); await codTransit(f);
      const input = { orderId: f.order.id, collectorDriverId: f.driver.id, actorUserId: f.driver.userId, operationId: randomUUID(), amount: f.before.cod.cashObligation.toFixed(2) };
      const collections = await Promise.all([recordCashCollection(input), recordCashCollection(input)]); expect(collections[0].id).toBe(collections[1].id);
      const collected = await codState(f.order.id); expect(collected.journals).toHaveLength(1); expect(collected.cod.events.filter(row => row.eventType === "COLLECTED")).toHaveLength(1);
      const promotionExpense = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-PROMOTION-EXPENSE-ZAR" } });
      const suspense = await prisma.ledgerAccount.findUniqueOrThrow({ where: { code: "PLATFORM-CASH-SHORT-OVER-SUSPENSE-ZAR" } });
      expect(suspense.purpose).toBe("COD_SHORTAGE_SUSPENSE"); expect(suspense.allowNegative).toBe(false); expect(suspense.id).not.toBe(promotionExpense.id);
      const received = suffix === "zero" ? "0.00" : collected.cod.cashCollected.sub("0.01").toFixed(2);
      const reconcile = { orderId: f.order.id, actorUserId: f.admin.id, receivedAmount: received, operationId: randomUUID(), evidenceReference: "SYNTHETIC_REMITTANCE_RECEIPT_NOT_PHYSICAL_EVIDENCE" };
      await reconcileCashCollection(reconcile);
      const shortage = await codState(f.order.id);
      expect(shortage.cod.status).toBe("UNDER_RECONCILIATION"); expect(shortage.cod.cashReconciled.toFixed(2)).toBe(received); expect(shortage.cod.remittanceDiscrepancy.equals(shortage.cod.cashCollected.sub(received))).toBe(true); expect(shortage.cod.reconciliationJournalId).toBeNull(); expect(shortage.cod.suspenseJournalId).not.toBeNull(); expect(shortage.cod.adjustmentJournalId).toBeNull();
      expect(shortage.cod.reconciliations).toHaveLength(1); expect(shortage.journals).toHaveLength(2);
      const journal = shortage.journals.find(row => row.id === shortage.cod.suspenseJournalId)!; expect(journal.totalDebits.equals(journal.totalCredits)).toBe(true); expect(journal.entries.every(row => row.amount.greaterThan(0))).toBe(true); expect(journal.entries).toHaveLength(suffix === "zero" ? 2 : 3);
      await reconcileCashCollection(reconcile); expect(await codState(f.order.id)).toEqual(shortage);
      await expect(reconcileCashCollection({ ...reconcile, receivedAmount: collected.cod.cashCollected.toFixed(2) })).rejects.toMatchObject({ code: "COD_RECONCILIATION_CONFLICT" }); expect(await codState(f.order.id)).toEqual(shortage);
      const correction = { orderId: f.order.id, actorUserId: f.admin.id, adjustmentReason: "Synthetic independently reviewed disposable shortage", adjustmentType: "RECOVER_FROM_DRIVER" as const, operationId: randomUUID() };
      await adjustCashOnDelivery(correction); const final = await codState(f.order.id); expect(final.cod.status).toBe("RECONCILED"); expect(final.journals).toHaveLength(3); expect(final.cod.events.filter(row => row.eventType === "ADMIN_ADJUSTED")).toHaveLength(1);
      await adjustCashOnDelivery(correction); expect(await codState(f.order.id)).toEqual(final);
      await expect(adjustCashOnDelivery({ ...correction, adjustmentType: "FORGIVE_SHORTAGE" })).rejects.toMatchObject({ code: "COD_ADJUSTMENT_CONFLICT" }); expect(await codState(f.order.id)).toEqual(final);
      await expect(adjustCashOnDelivery({ ...correction, operationId: randomUUID() })).rejects.toMatchObject({ code: "COD_ALREADY_ADJUSTED" }); expect(await codState(f.order.id)).toEqual(final);
      const cash = await prisma.ledgerAccount.findFirstOrThrow({ where: { wallet: { ownerType: "DRIVER", ownerId: f.driver.id }, purpose: "CASH_CLEARING" } }); expect(cash.currentBalance.isZero()).toBe(true);
      for (const row of final.journals) expect(row.totalDebits.equals(row.totalCredits)).toBe(true);
    });
  }, 180_000);

  it("rejects cancelled collection and over-limit booking, and replays failed cash attempts without a journal", async () => {
    await withCanonicalBrowser(async page => {
      const f = await codBooking(page, "failure");
      const newQuote = await createPricingQuote(f.user, { deliveryType: f.input.deliveryType, pickupAddress: f.input.pickupAddress, dropoffAddress: f.input.dropoffAddress });
      await prisma.paymentMethodPolicy.update({ where: { id: f.policy.id }, data: { maximumCodAmount: "0.01" } });
      const count = await prisma.order.count({ where: { storeId: f.store.id } });
      await expect(createOrder(f.user, { ...f.input, pricingQuoteId: newQuote.id })).rejects.toMatchObject({ code: "COD_LIMIT_EXCEEDED" });
      expect(await prisma.order.count({ where: { storeId: f.store.id } })).toBe(count); expect((await prisma.pricingQuote.findUniqueOrThrow({ where: { id: newQuote.id } })).status).toBe("ACTIVE"); expect(await codState(f.order.id)).toEqual(f.before);
      await verifyCodDeposit(page, f);
      await prisma.$transaction(tx => transitionOrderStatusInTx(tx, { orderId: f.order.id, toStatus: "CANCELLED", actorRole: "SUPER_ADMIN", actorUserId: f.admin.id, reason: "Synthetic cancellation before custody", source: "DISPOSABLE_COD_CANCEL" }));
      const cancelled = await codState(f.order.id);
      await expect(recordCashCollection({ orderId: f.order.id, collectorDriverId: f.driver.id, actorUserId: f.driver.userId, amount: f.before.cod.cashObligation.toFixed(2), operationId: randomUUID() })).rejects.toThrow(); expect(await codState(f.order.id)).toEqual(cancelled);
      const next = await codBooking(page, "failure"); await verifyCodDeposit(page, next); await codTransit(next);
      const failure = { orderId: next.order.id, collectorDriverId: next.driver.id, actorUserId: next.driver.userId, reasonCode: "INSUFFICIENT_CASH" as const, operationId: randomUUID() };
      await recordCashCollectionFailure(failure); const failed = await codState(next.order.id); expect(failed.cod.status).toBe("COLLECTION_FAILED"); expect(failed.journals).toEqual([]); expect(failed.cod.cashCollected.isZero()).toBe(true);
      await recordCashCollectionFailure(failure); expect(await codState(next.order.id)).toEqual(failed);
      await expect(recordCashCollectionFailure({ ...failure, reasonCode: "CUSTOMER_REFUSED" })).rejects.toMatchObject({ code: "COD_COLLECTION_CONFLICT" }); expect(await codState(next.order.id)).toEqual(failed);
    });
  }, 180_000);
});
