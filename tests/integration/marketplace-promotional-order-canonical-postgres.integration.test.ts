import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/db/prisma";
import { withCanonicalBrowser, canonicalPaidBasket } from "./marketplace-canonical-support";
import { prepareStoreOrder } from "../e2e/fixtures/store-order";
import { rejectMarketplaceStoreOrder } from "../../lib/store-orders/store-order.service";
import { ExistingPhaseFinancialAdjustmentAuthority } from "../../lib/store-orders/financial-adjustment-composition";
import { applyMarketplaceStoreOrderAdjustment } from "../../lib/store-orders/store-order.service";
import { assertDisposablePaystackAcceptance } from "../../lib/testing/disposable-paystack-policy";
import { RefundProviderRegistry } from "../../lib/refunds/providers/refund-provider-registry";
import { PaystackRefundAdapter } from "../../lib/refunds/providers/paystack/paystack-refund-adapter";
import { assertCanonicalRefundDatabase, CanonicalOfflineRefundClient, protectedRefundState } from "./refund-canonical-support";
import { createHash, randomUUID } from "node:crypto";

describe("canonical promotional marketplace order and financial reversal lifecycle", () => {
  it("freezes multi-store platform subsidy, posts balanced promotional journal, and reverses net customer funds on cancellation", async () => {
    await withCanonicalBrowser(async (page) => {
      await assertCanonicalRefundDatabase();
      const f = await canonicalPaidBasket(page, "promo-multistore", {
        baseLine: { offerReference: "CO-E2E64GB", variantReference: "CV-E2E64GB", quantity: 2, modifiers: [{ groupReference: "mod_warranty", optionReference: "opt_2yr", quantity: 1 }] },
        lines: [{ offerReference: "CO-RESIDUAL-three", variantReference: "CV-RESIDUAL-three", quantity: 1, modifiers: [] }],
      });

      const order = await prisma.marketplaceOrder.findUniqueOrThrow({
        where: { id: f.paid.orders[0].id },
        include: {
          payment: true,
          storeOrders: {
            include: {
              lines: { include: { modifiers: true } },
              settlementSnapshots: { include: { sourceSettlementEvidence: true } },
              checkoutStoreGroup: true,
            },
          },
        },
      });

      expect(order.storeOrders).toHaveLength(2);
      const snapshots = order.storeOrders.flatMap((row) => row.settlementSnapshots);
      expect(snapshots).toHaveLength(2);

      // Verify conserved monetary totals
      const grossMerchandise = snapshots.reduce((sum, row) => sum.add(row.sellerBasis), new Prisma.Decimal(0));
      const deliveryFees = snapshots.reduce((sum, row) => sum.add(row.deliveryFeeResidual), new Prisma.Decimal(0));
      const grossTotal = grossMerchandise.add(deliveryFees);

      expect(order.promotionDiscount.greaterThan(0)).toBe(true);
      expect(order.promotionDiscount.toFixed(2)).toBe("50.00");
      expect(order.grandTotal.add(order.promotionDiscount).equals(grossTotal)).toBe(true);
      expect(order.payment.amount.equals(order.grandTotal)).toBe(true);

      // Verify durable platform subsidy journal was posted
      const subsidyJournal = await prisma.ledgerJournal.findFirst({
        where: {
          correlationId: order.id,
          memo: { contains: "Platform Promotion Subsidy" },
        },
        include: { entries: { include: { account: true } } },
      });

      expect(subsidyJournal).toBeDefined();
      expect(subsidyJournal!.totalDebits.equals(order.promotionDiscount)).toBe(true);
      expect(subsidyJournal!.totalCredits.equals(order.promotionDiscount)).toBe(true);

      const debitEntry = subsidyJournal!.entries.find((e) => e.direction === "DEBIT")!;
      const creditEntry = subsidyJournal!.entries.find((e) => e.direction === "CREDIT")!;
      expect(debitEntry.account.code).toBe("PLATFORM-PROMOTION-EXPENSE-ZAR");
      expect(creditEntry.account.code).toBe("PLATFORM-CUSTOMER-FUNDS-HELD-ZAR");
      expect(debitEntry.amount.equals(order.promotionDiscount)).toBe(true);
      expect(creditEntry.amount.equals(order.promotionDiscount)).toBe(true);

      // Verify seller earnings remain gross-grounded
      for (const frozen of snapshots) {
        expect(frozen.sellerBasis.sub(frozen.commissionAmount).equals(frozen.storeEarningAmount)).toBe(true);
      }
    });
  }, 180_000);

  it("calculates net customer refund and platform subsidy reversal on full cancellation of a discounted store order", async () => {
    await withCanonicalBrowser(async (page) => {
      await assertCanonicalRefundDatabase();
      const f = await prepareStoreOrder(page, "promo-full-rejection", 390);
      const payment = await prisma.payment.findUniqueOrThrow({
        where: { id: f.snapshot.payment.id },
        include: { successfulAttempt: true },
      });

      const orderId = f.order.storeOrders[0].id;
      const snapshot = await prisma.marketplaceSettlementSnapshot.findFirstOrThrow({
        where: { marketplaceStoreOrderId: orderId },
      });

      const owner = await prisma.user.findUniqueOrThrow({ where: { email: "e2e-store@ktcouriers.local" } });
      const operationId = randomUUID();
      const requestHash = createHash("sha256").update(operationId).digest("hex");
      const action = { storeOrderReference: f.storeReference, actorUserId: owner.id, operationId, requestHash, reasonCode: "STORE_CLOSED" };

      await rejectMarketplaceStoreOrder(action);

      const adjustments = await prisma.marketplaceStoreOrderAdjustment.findMany({
        where: { marketplaceStoreOrderId: orderId },
        include: { allocations: true },
      });

      expect(adjustments).toHaveLength(1);
      const adj = adjustments[0];
      const evidence = adj.financialEvidence as Record<string, unknown>;

      // Net customer refund matches actual payment amount
      expect(adj.refundAmount.equals(payment.amount)).toBe(true);
      expect(evidence.platformSubsidyReversal).toBe("50.00");
      expect(evidence.grossRefundAmount).toBe(snapshot.sellerBasis.add(snapshot.deliveryFeeResidual).toFixed(2));

      // Apply adjustment and verify refund reservation
      const client = new CanonicalOfflineRefundClient(payment.successfulAttempt!.providerReference!);
      const registry = new RefundProviderRegistry([new PaystackRefundAdapter(client)]);
      const dependencies = { assertProductionReady: () => assertDisposablePaystackAcceptance(), registry, providerRegistry: registry };
      const apply = {
        ...action,
        adjustmentReference: adj.publicReference,
        dependencies: { financialAuthority: new ExistingPhaseFinancialAdjustmentAuthority(dependencies) },
      };

      const result = await applyMarketplaceStoreOrderAdjustment(apply);
      expect(result).toMatchObject({ financialStatus: "REFUND_RESERVED" });

      // Verify payment refund reservation does not exceed customer payment
      const refundState = await protectedRefundState(payment.id);
      expect(refundState.payment.totalRefundReservedAmount.equals(payment.amount)).toBe(true);

      // Verify platform subsidy reversal journal was posted
      const reversalJournal = await prisma.ledgerJournal.findFirst({
        where: {
          correlationId: adj.id,
          memo: { contains: "Platform Promotion Subsidy Reversal" },
        },
        include: { entries: { include: { account: true } } },
      });

      expect(reversalJournal).toBeDefined();
      expect(reversalJournal!.totalDebits.toFixed(2)).toBe("50.00");
      expect(reversalJournal!.totalCredits.toFixed(2)).toBe("50.00");
      const revDebit = reversalJournal!.entries.find((e) => e.direction === "DEBIT")!;
      const revCredit = reversalJournal!.entries.find((e) => e.direction === "CREDIT")!;
      expect(revDebit.account.code).toBe("PLATFORM-CUSTOMER-FUNDS-HELD-ZAR");
      expect(revCredit.account.code).toBe("PLATFORM-PROMOTION-EXPENSE-ZAR");
    });
  }, 180_000);
});