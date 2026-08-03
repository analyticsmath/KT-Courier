/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 delegates remain dynamic until Prisma generation is permitted. */
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import { finalizePaidMarketplaceCheckout, type MarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";
import { assertPaymentSubjectIntegrity } from "@/lib/payments/payment-subject-policy";
import { prisma } from "@/lib/db/prisma";
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";
import { assertMarketplaceCheckoutProductionReady } from "@/lib/marketplace-checkout/production-lock";

export type MarketplacePaymentSuccessHookRepository = Readonly<{
  getPaymentSubject(paymentId: string): Promise<{
    id: string; subjectType: "COURIER_ORDER" | "MARKETPLACE_CHECKOUT"; userId: string | null; orderId: string | null;
    marketplaceCheckoutId: string | null; marketplaceOrderId: string | null; checkoutCustomerUserId: string | null; checkoutGuestAccessTokenHash: string | null;
  } | null>;
  createOrResolveFinalizationReceipt(input: Readonly<{ paymentId: string; checkoutId: string; operationId: string }>): Promise<{ operationId: string }>;
  markCheckoutReconciliationRequired(input: Readonly<{ checkoutId: string; paymentId: string; operationId: string; safeReason: string }>): Promise<void>;
}>;

/**
 * Called only after the Phase 12 payment-success transaction has committed.
 * A marketplace failure is isolated into reconciliation and never rolls back
 * the verified provider receipt or the held customer funds.
 */
export async function onVerifiedMarketplacePaymentSucceeded(
  repository: MarketplacePaymentSuccessHookRepository,
  finalizationRepository: MarketplaceFinalizationRepository,
  paymentId: string,
  testApproval?: { approved: true },
): Promise<void> {
  const payment = await repository.getPaymentSubject(paymentId);
  if (!payment || payment.subjectType !== "MARKETPLACE_CHECKOUT") return;
  assertPaymentSubjectIntegrity(payment);
  const receipt = await repository.createOrResolveFinalizationReceipt({ paymentId: payment.id, checkoutId: payment.marketplaceCheckoutId!, operationId: `marketplace-finalization:${payment.id}` });
  try {
    // The provider receipt and durable finalization intent are safe evidence;
    // only canonical finalization remains behind the source production gate.
    assertMarketplaceCheckoutProductionReady("ORDER_FINALIZATION", testApproval);
    await finalizePaidMarketplaceCheckout(finalizationRepository, { paymentId: payment.id, checkoutId: payment.marketplaceCheckoutId!, operationId: receipt.operationId, testApproval });
  } catch (error) {
    await repository.markCheckoutReconciliationRequired({ checkoutId: payment.marketplaceCheckoutId!, paymentId: payment.id, operationId: receipt.operationId, safeReason: error instanceof MarketplaceCheckoutError ? error.code : "FINALIZATION_APPLICATION_FAILURE" });
  }
}

export function createPrismaMarketplacePaymentSuccessHookRepository(database: any = prisma): MarketplacePaymentSuccessHookRepository {
  return Object.freeze({
    async getPaymentSubject(paymentId) {
      const payment = await database.payment.findUnique({ where: { id: paymentId }, include: { marketplaceCheckout: true } });
      if (!payment) return null;
      return { id: payment.id, subjectType: payment.subjectType, userId: payment.userId, orderId: payment.orderId, marketplaceCheckoutId: payment.marketplaceCheckoutId, marketplaceOrderId: payment.marketplaceOrderId, checkoutCustomerUserId: payment.marketplaceCheckout?.customerUserId ?? null, checkoutGuestAccessTokenHash: payment.marketplaceCheckout?.guestAccessTokenHash ?? null };
    },
    async createOrResolveFinalizationReceipt(input) {
      const existing = await database.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId: input.checkoutId, operationId: input.operationId } } });
      if (existing) return { operationId: existing.operationId };
      await database.marketplaceCheckoutOperation.create({ data: { checkoutId: input.checkoutId, operationId: input.operationId, requestHash: `payment:${input.paymentId}`, type: "FINALIZE", response: { paymentId: input.paymentId } } });
      return { operationId: input.operationId };
    },
    async markCheckoutReconciliationRequired(input) {
      await database.$transaction(async (tx: any) => {
        await tx.marketplaceCheckout.update({ where: { id: input.checkoutId }, data: { status: "RECONCILIATION_REQUIRED" } });
        await tx.marketplaceCheckoutReconciliationCase.upsert({ where: { checkoutId_reason_operationId: { checkoutId: input.checkoutId, reason: "ORDER_CREATION_FAILURE", operationId: input.operationId } }, create: { publicReference: `mrec_${input.operationId}`, checkoutId: input.checkoutId, paymentId: input.paymentId, reason: "ORDER_CREATION_FAILURE", priority: "CRITICAL", safeSummary: input.safeReason, operationId: input.operationId }, update: { observationCount: { increment: 1 }, safeSummary: input.safeReason } });
      });
    },
  });
}

export async function onVerifiedMarketplacePaymentSucceededInProduction(paymentId: string): Promise<void> {
  // The explicit Phase 20 gate is intentionally evaluated by the finalizer.
  await onVerifiedMarketplacePaymentSucceeded(createPrismaMarketplacePaymentSuccessHookRepository(), createPrismaMarketplaceFinalizationRepository(), paymentId);
}
