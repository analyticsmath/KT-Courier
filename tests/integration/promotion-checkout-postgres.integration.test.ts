import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { beforeAll, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireDisposableStoreSettlementDatabase } from "@/scripts/disposable-store-settlement-guard";
import { ensureLedgerAccount, ensureWalletForOwner } from "@/lib/services/wallet-account.service";
import { postLedgerJournal } from "@/lib/services/ledger-posting.service";
import { reserveCheckoutPromotions } from "@/lib/promotions/promotion-reservation.service";
import { commitMarketplacePromotionRedemptions } from "@/lib/promotions/promotion-redemption.service";
import type { AppliedPromotion, PromotionEvaluationResult } from "@/lib/promotions/promotion-evaluation.service";
import { reversePromotionBudgetForAdjustment } from "@/lib/promotions/promotion-adjustment-reversal";
import { createPrismaMarketplaceFinalizationRepository } from "@/lib/marketplace-checkout/prisma-marketplace-finalization.repository";
import { recoverPromotionCommitments } from "@/lib/promotions/promotion-commit-recovery";
import { applyPromotionRefundAdjustment } from "@/lib/promotions/promotion-refund.service";
import { recoverPromotionReversals } from "@/lib/promotions/promotion-reversal-recovery";
import { accrueCommissionInTransaction } from "@/lib/services/commission-accrual.service";
import { accrueStoreEarningInTransaction } from "@/lib/services/store-earning-accrual.service";
import { ensureStoreEarningPayableAccount } from "@/lib/services/store-earning-account.service";
import { ensureCustomerRefundWallet } from "@/lib/services/customer-wallet.service";
import {
  beginStoreOrderReview,
  confirmStoreOrderLineAvailability,
  updateStoreOrderSubstitutionPreference,
  proposeStoreOrderSubstitution,
  decideStoreOrderSubstitution,
  applyMarketplaceStoreOrderAdjustment,
} from "@/lib/store-orders/store-order.service";
import { ExistingPhaseFinancialAdjustmentAuthority } from "@/lib/store-orders/financial-adjustment-composition";
import { STORE_ORDER_PERMISSION_KEYS } from "@/lib/store-orders/store-order-auth";
import { approveRefund } from "@/lib/services/refund-finance-review.service";
import { startProviderRefund } from "@/lib/services/refund-provider-execution.service";
import { PaystackClient, type PaystackRefundData, type PaystackRefundInput } from "@/lib/payments/providers/paystack/paystack-client";
import { PaystackRefundAdapter } from "@/lib/refunds/providers/paystack/paystack-refund-adapter";
import { RefundProviderRegistry } from "@/lib/refunds/providers/refund-provider-registry";

beforeAll(() => requireDisposableStoreSettlementDatabase());

it("checks the actual migrated database in the promotion preflight", () => {
  const output = execFileSync(process.execPath, ["scripts/phase23-promotion-preflight.mjs"], { encoding: "utf8", env: process.env });
  expect(JSON.parse(output)).toMatchObject({ databaseReachable: true, missingTables: [], failedMigrations: 0, missingPermissions: [] });
}, 30_000);

it("reserves reviewed allocations, posts one funded redemption and preserves source evidence", async () => {
  const nonce = randomUUID(), marker = `promo-flow-${nonce}`;
  const customer = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { name: "Promotion fixture", slug: marker, status: "ACTIVE" } });
  const cart = await prisma.marketplaceCart.create({ data: { publicReference: `${marker}-cart`, ownerType: "CUSTOMER", customerUserId: customer.id, status: "CHECKOUT_LOCKED" } });
  const checkout = await prisma.marketplaceCheckout.create({ data: { publicReference: `${marker}-checkout`, cartId: cart.id, customerUserId: customer.id, status: "READY_FOR_REVIEW", reviewVersion: 1, merchandiseSubtotal: "100.00", promotionDiscount: "10.00", grandTotal: "90.00", digitalRequired: "90.00", commercialFingerprint: marker, acceptedFingerprint: marker, reviewAcceptedAt: new Date() } });
  const group = await prisma.marketplaceCheckoutStoreGroup.create({ data: { checkoutId: checkout.id, storeId: store.id, fulfilmentMode: "COURIER_DELIVERY", merchandiseSubtotal: "100.00", groupTotal: "100.00" } });
  const line = await prisma.marketplaceCheckoutLineSnapshot.create({ data: { checkoutId: checkout.id, storeGroupId: group.id, reviewVersion: 1, productReference: `${marker}-product`, variantReference: `${marker}-variant`, offerReference: `${marker}-offer`, storeReference: store.id, productTitle: "Item", variantTitle: "Default", quantity: 1, sellingUnit: "EACH", publicationVersion: "1", priceVersion: "1", baseUnitPrice: "100.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "100.00", lineTotal: "100.00", taxTreatment: "INCLUDED" } });
  const campaign = await prisma.promotionCampaign.create({ data: { publicReference: `${marker}-campaign`, internalCode: marker, ownerType: "PLATFORM", name: "Promotion", status: "ACTIVE" } });
  const version = await prisma.promotionCampaignVersion.create({ data: { campaignId: campaign.id, publicReference: `${marker}-version`, versionNumber: 1, status: "ACTIVE", applicationMethod: "AUTOMATIC", discountScope: "LINE", discountMechanism: "FIXED_AMOUNT", fixedAmount: 10, fundingType: "SHARED_PLATFORM_STORE", platformFundingShareBps: 6000, storeFundingShareBps: 4000, maximumRedemptionsGlobal: 1, startsAt: new Date(Date.now()-60000), endsAt: new Date(Date.now()+86400000) } });
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100 } });
  const amount = (v: string) => new Prisma.Decimal(v);
  const allocation = { lineId: line.id, basisAmount: amount("100"), discountAmount: amount("10"), platformFunding: amount("6"), storeFunding: amount("4") };
  const applied: AppliedPromotion = { campaignVersionId: version.id, campaignId: campaign.id, publicReference: version.publicReference, applicationMethod: "AUTOMATIC", discountScope: "LINE", calculatedDiscount: amount("10"), fundingType: "SHARED", platformFundingShareBps: 6000, customerFacingTitle: "Promotion", campaignName: "Promotion", category: "AUTOMATIC_MERCHANDISE", allocations: [allocation], platformFunding: amount("6"), storeFunding: amount("4") };
  const evaluation: PromotionEvaluationResult = { eligible: [applied], applied: [applied], rejected: [], stackingEvidence: { selectedPromotionIds: [version.id], rejectedPromotionIds: [], rejectionReasons: {} }, totalDiscount: amount("10"), totalPlatformFunding: amount("6"), totalStoreFunding: amount("4"), allocations: [allocation] };
  const reserved = await prisma.$transaction(tx => reserveCheckoutPromotions({ checkoutId: checkout.id, checkoutReviewVersion: 1, customerUserId: customer.id, evaluationResult: evaluation, appliedPromotions: [applied], operationId: `${marker}-reserve`, requestHash: "a".repeat(64), now: new Date() }, tx));
  const platform = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const cash = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
  const held = await ensureLedgerAccount({ walletId: platform.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });
  const payRef = `PAY-${nonce}`;
  const receipt = await postLedgerJournal({ idempotencyKey: `${marker}-receipt`, sourceReference: `PROMOTEST:${nonce.replaceAll("-", "").toUpperCase()}`, correlationId: payRef, type: "EXTERNAL_PAYMENT_RECEIPT", currency: "ZAR", actor: { kind: "SYSTEM" }, entries: [{ accountId: cash.id, direction: "DEBIT", amount: "90.00", lineCode: "CASH" }, { accountId: held.id, direction: "CREDIT", amount: "90.00", lineCode: "HELD" }] });
  const payment = await prisma.payment.create({ data: { publicReference: payRef, userId: customer.id, marketplaceCheckoutId: checkout.id, subjectType: "MARKETPLACE_CHECKOUT", provider: "PAYSTACK", status: "PENDING", amount: "90.00", creationIdempotencyKey: `${marker}-payment`, creationRequestHash: "b".repeat(64) } });
  const recovery = { checkoutId: checkout.id, paymentId: payment.id, operationId: `marketplace-finalization:${payment.id}` };
  const recoveryCase = await prisma.marketplaceCheckoutReconciliationCase.create({ data: { publicReference: `${marker}-recovery`, ...recovery, reason: "ORDER_CREATION_FAILURE", safeSummary: "Retry fixture" } });
  const repository = createPrismaMarketplaceFinalizationRepository();
  await expect(repository.transaction(async () => { expect(await repository.mayRecoverFinalization!(recovery)).toBe(true); await repository.resolveFinalizationRecovery!(recovery); throw new Error("rollback fixture"); })).rejects.toThrow("rollback fixture");
  expect((await prisma.marketplaceCheckoutReconciliationCase.findUniqueOrThrow({ where: { id: recoveryCase.id } })).status).toBe("OPEN");
  await prisma.marketplaceCheckoutReconciliationCase.create({ data: { publicReference: `${marker}-independent-case`, ...recovery, operationId: `${marker}-independent`, reason: "PAYMENT_AMOUNT_MISMATCH", safeSummary: "Independent fixture" } });
  await repository.transaction(async () => { expect(await repository.mayRecoverFinalization!(recovery)).toBe(false); });
  const attempt = await prisma.paymentAttempt.create({ data: { paymentId: payment.id, attemptNumber: 1, provider: "PAYSTACK", idempotencyKey: `${marker}-attempt`, requestHash: "c".repeat(64), merchantReference: `${marker}-merchant`, status: "SUCCEEDED", amount: "90.00", currency: "ZAR", providerEnvironment: "SANDBOX", providerConfirmedAt: new Date() } });
  const webhook = await prisma.paymentWebhookEvent.create({ data: { publicReference: `pwe_${nonce}`, provider: "PAYSTACK", environment: "SANDBOX", eventFingerprint: createHash("sha256").update(nonce).digest("hex"), merchantReference: attempt.merchantReference, providerStatus: "success", normalizedStatus: "COMPLETE", processingStatus: "APPLIED", paymentId: payment.id, attemptId: attempt.id, sourceAddressVerified: true, signatureVerified: true, merchantVerified: true, amountVerified: true, providerDataVerified: true, verifiedAt: new Date(), appliedAt: new Date(), ledgerJournalId: receipt.id } });
  await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED", successfulAttemptId: attempt.id, successWebhookEventId: webhook.id, successLedgerJournalId: receipt.id, providerConfirmedAt: new Date(), succeededAt: new Date(), version: { increment: 1 } } });
  await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { status: "RECONCILIATION_REQUIRED" } });
  expect(await recoverPromotionCommitments({ limit: 1, after: reserved.reservationIds[0].slice(0, -1) })).toMatchObject({ examined: 1, eligible: 1, completed: 0, failed: 0 });
  expect((await prisma.promotionReservation.findUniqueOrThrow({ where: { id: reserved.reservationIds[0] } })).status).toBe("RESERVED");
  await prisma.marketplaceCheckout.update({ where: { id: checkout.id }, data: { status: "READY_FOR_REVIEW" } });
  const order = await prisma.marketplaceOrder.create({ data: { publicReference: `${marker}-order`, checkoutId: checkout.id, paymentId: payment.id, customerUserId: customer.id, merchandiseSubtotal: "100.00", modifierSubtotal: "0.00", deliveryFeeTotal: "0.00", promotionDiscount: "10.00", grandTotal: "90.00", digitalRequired: "90.00", commercialFingerprint: marker, status: "CONFIRMED" } });
  const commit = () => prisma.$transaction(tx => commitMarketplacePromotionRedemptions({ checkoutId: checkout.id, checkoutReviewVersion: 1, acknowledgementFingerprint: marker, paymentId: payment.id, paymentStatus: "SUCCEEDED", marketplaceOrderId: order.id, reservationIds: reserved.reservationIds, frozenEvaluation: evaluation, operationId: `${marker}-commit`, requestHash: "d".repeat(64), now: new Date() }, tx));
  const [first, replay] = await Promise.all([commit(), commit()]);
  expect(first.redemptions[0].id).toBe(replay.redemptions[0].id);
  const redemption = await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: first.redemptions[0].id }, include: { allocations: true } });
  expect(redemption.allocations).toHaveLength(1);
  expect(redemption.allocations[0]).toMatchObject({ lineReference: line.id, storeGroupReference: group.id, allocationType: "MERCHANDISE" });
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).committedAmount.toFixed(2)).toBe("10.00");
  const journal = await prisma.ledgerJournal.findUniqueOrThrow({ where: { idempotencyKey: `LJ-PROMO-${redemption.id}` } });
  expect(journal.totalDebits.toFixed(2)).toBe("6.00");
  expect(journal.totalCredits.toFixed(2)).toBe("6.00");
  const storeOrder = await prisma.marketplaceStoreOrder.create({ data: { publicReference: `${marker}-store-order`, marketplaceOrderId: order.id, checkoutStoreGroupId: group.id, storeId: store.id, merchandiseSubtotal: "100.00", modifierSubtotal: "0.00", deliveryFee: "0.00", groupTotal: "100.00" } });
  const orderLine = await prisma.marketplaceOrderLine.create({ data: { marketplaceStoreOrderId: storeOrder.id, checkoutLineSnapshotId: line.id, productReference: line.productReference, variantReference: line.variantReference, offerReference: line.offerReference, title: "Item", variantTitle: "Default", quantity: 1, baseUnitPrice: "100.00", modifierUnitTotal: "0.00", effectiveUnitPrice: "100.00", lineTotal: "100.00", taxTreatment: "INCLUDED" } });
  const adjustment = { adjustmentId: `${marker}-adjustment`, storeOrderId: storeOrder.id, marketplaceOrderId: order.id, checkoutStoreGroupId: group.id, deliveryFeeAmount: amount("0"), allocations: [{ marketplaceOrderLineId: orderLine.id, allocationType: "SELLER_BASIS", originalQuantity: 1, resolvedQuantityBefore: 0, resolvedQuantityAfter: 1 }] };
  const reverse = () => prisma.$transaction(tx => reversePromotionBudgetForAdjustment(tx, adjustment));
  const [reversed, repeated] = await Promise.all([reverse(), reverse()]);
  expect(reversed).toEqual(repeated);
  expect((await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: redemption.id } })).status).toBe("FULLY_REVERSED");
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).reversedAmount.toFixed(2)).toBe("10.00");
  expect(await prisma.promotionBudgetMovement.count({ where: { redemptionId: redemption.id, movementType: "REVERSE" } })).toBe(1);
  await expect(prisma.$transaction(tx => reserveCheckoutPromotions({ checkoutId: checkout.id, checkoutReviewVersion: 1, customerUserId: customer.id, evaluationResult: evaluation, appliedPromotions: [applied], operationId: `${marker}-retry-after-reversal`, requestHash: "e".repeat(64), now: new Date() }, tx))).rejects.toThrow("redemption limit");
}, 30_000);

class DisposablePromotionRefundPaystackClient extends PaystackClient {
  outcome: "processed" | "wrong-amount" | "wrong-reference" = "processed";
  calls = 0;
  private nextId: number;
  readonly accepted = new Map<string, { amount: number; transaction: string }>();

  constructor(readonly sourceReference: string) {
    super({ secretKey: "sk_test_disposable_promotion_refund" });
    this.nextId = parseInt(createHash("sha256").update(sourceReference).digest("hex").slice(0, 12), 16);
  }

  async createRefund(input: PaystackRefundInput): Promise<PaystackRefundData> {
    requireDisposableStoreSettlementDatabase();
    expect(input.transaction).toBe(this.sourceReference);
    expect(input.currency).toBe("ZAR");
    expect(Number.isSafeInteger(input.amountCents) && input.amountCents! > 0).toBe(true);
    this.calls++;
    const id = ++this.nextId;
    this.accepted.set(String(id), { amount: input.amountCents!, transaction: input.transaction });
    return this.facts(String(id));
  }

  async getRefund(id: string): Promise<PaystackRefundData> {
    requireDisposableStoreSettlementDatabase();
    return this.facts(id);
  }

  private facts(id: string): PaystackRefundData {
    const accepted = this.accepted.get(id)!;
    return {
      id: Number(id),
      transaction: {
        id: 1,
        reference: this.outcome === "wrong-reference" ? "foreign-provider-transaction" : accepted.transaction,
      },
      amount: accepted.amount + (this.outcome === "wrong-amount" ? 100 : 0),
      deducted_amount: this.outcome === "processed" ? accepted.amount : 0,
      currency: "ZAR",
      status: "processed",
    } as PaystackRefundData;
  }
}

it("executes mixed-discount substitute/refund lifecycle on PostgreSQL with negative variants and zero-duplicate replay (E2)", async () => {
  const nonce = randomUUID();
  const marker = `promo-sub-${nonce}`;
  const hash = (tag: string) => createHash("sha256").update(`${marker}:${tag}`).digest("hex");
  const amount = (v: string) => new Prisma.Decimal(v);

  const [customer, storeOwner, foreignOwner, approver, processor] = await Promise.all([
    prisma.user.create({ data: { email: `${marker}-cust@example.test`, role: "CUSTOMER", status: "ACTIVE" } }),
    prisma.user.create({ data: { email: `${marker}-owner@example.test`, role: "STORE", status: "ACTIVE" } }),
    prisma.user.create({ data: { email: `${marker}-foreign@example.test`, role: "STORE", status: "ACTIVE" } }),
    prisma.user.create({ data: { email: `${marker}-approver@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } }),
    prisma.user.create({ data: { email: `${marker}-processor@example.test`, role: "SUPER_ADMIN", status: "ACTIVE" } }),
  ]);

  for (const key of STORE_ORDER_PERMISSION_KEYS) {
    const perm = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, name: key, category: "STORE_ORDERS" },
    });
    await prisma.rolePermission.upsert({
      where: { role_permissionId: { role: "STORE", permissionId: perm.id } },
      update: { enabled: true },
      create: { role: "STORE", permissionId: perm.id, enabled: true },
    });
  }

  const [store, foreignStore] = await Promise.all([
    prisma.store.create({ data: { name: "Mixed Promo Store", slug: marker, status: "ACTIVE", ownerUserId: storeOwner.id } }),
    prisma.store.create({ data: { name: "Foreign Store", slug: `${marker}-foreign`, status: "ACTIVE", ownerUserId: foreignOwner.id } }),
  ]);

  const [location, foreignLocation] = await Promise.all([
    prisma.inventoryLocation.create({ data: { publicReference: `${marker}-loc`, storeId: store.id, name: "Primary", status: "ACTIVE", isPrimary: true } }),
    prisma.inventoryLocation.create({ data: { publicReference: `${marker}-floc`, storeId: foreignStore.id, name: "Primary", status: "ACTIVE", isPrimary: true } }),
  ]);

  const productType = await prisma.productTypeDefinition.create({
    data: {
      publicReference: `${marker}-ptype`,
      code: marker.replaceAll("-", "_").toUpperCase(),
      name: "Grocery",
      versionNumber: 1,
      status: "ACTIVE",
      attributeSchema: {},
      variantSchema: {},
      complianceSchema: {},
      searchFacetSchema: {},
      createdByUserId: approver.id,
      approvedByUserId: approver.id,
      activatedAt: new Date(),
    },
  });

  const category = await prisma.catalogCategory.create({
    data: {
      publicReference: `${marker}-cat`,
      name: "Pantry",
      slug: marker,
      path: `/${marker}`,
      status: "ACTIVE",
      createdByUserId: approver.id,
      updatedByUserId: approver.id,
    },
  });

  async function createCatalogOffer(targetStoreId: string, targetLocationId: string, tag: string, priceStr: string, stock: number) {
    const prod = await prisma.catalogProduct.create({
      data: {
        publicReference: `${marker}-prod-${tag}`,
        scope: "STORE_PRIVATE",
        sourceStoreId: targetStoreId,
        productTypeDefinitionId: productType.id,
        productTypeVersionNumber: 1,
        primaryCategoryId: category.id,
        title: `Item ${tag}`,
        normalizedTitle: `item ${tag}`,
        attributeValues: {},
        complianceValues: {},
        status: "DRAFT",
        moderationStatus: "NOT_SUBMITTED",
        publicationStatus: "DRAFT",
        slug: `${marker}-${tag}`,
        qualityIssues: [],
        createdByUserId: approver.id,
      },
    });
    const variant = await prisma.catalogProductVariant.create({
      data: {
        publicReference: `${marker}-var-${tag}`,
        productId: prod.id,
        title: "Standard",
        normalizedTitle: "standard",
        optionFingerprint: `default-${tag}`,
        attributeValues: {},
        status: "ACTIVE",
      },
    });
    await prisma.catalogProduct.update({
      where: { id: prod.id },
      data: {
        status: "ACTIVE",
        moderationStatus: "APPROVED",
        publicationStatus: "PUBLISHED",
        approvedByUserId: approver.id,
      },
    });
    const offer = await prisma.storeCatalogOffer.create({
      data: {
        publicReference: `${marker}-off-${tag}`,
        storeId: targetStoreId,
        productId: prod.id,
        variantId: variant.id,
        storeSku: `SKU-${tag}`,
        status: "DRAFT",
        publicationStatus: "DRAFT",
        inventoryTrackingMode: "TRACKED",
        fulfilmentMode: "COURIER_DELIVERY",
        sellingUnit: "EACH",
        primaryInventoryLocationId: targetLocationId,
        createdByUserId: approver.id,
      },
    });
    const price = await prisma.storeOfferPriceVersion.create({
      data: {
        publicReference: `${marker}-prc-${tag}`,
        offerId: offer.id,
        versionNumber: 1,
        amount: priceStr,
        currency: "ZAR",
        effectiveFrom: new Date(Date.now() - 60_000),
        status: "ACTIVE",
        createdByUserId: approver.id,
        activatedByUserId: approver.id,
        activatedAt: new Date(),
      },
    });
    const activeOffer = await prisma.storeCatalogOffer.update({
      where: { id: offer.id },
      data: {
        currentPriceVersionId: price.id,
        status: "ACTIVE",
        publicationStatus: "PUBLISHED",
        approvedByUserId: approver.id,
      },
    });
    const invItem = await prisma.catalogInventoryItem.create({
      data: {
        publicReference: `${marker}-inv-${tag}`,
        offerId: activeOffer.id,
        variantId: variant.id,
        trackingMode: "TRACKED",
      },
    });
    const level = await prisma.$transaction(async (tx) => {
      const createdLevel = await tx.catalogInventoryLevel.create({
        data: {
          inventoryItemId: invItem.id,
          locationId: targetLocationId,
          onHand: stock,
          reserved: 0,
          available: stock,
        },
      });
      if (stock > 0) {
        await tx.catalogInventoryMovement.create({
          data: {
            publicReference: `${marker}-cim-init-${tag}`,
            inventoryItemId: invItem.id,
            locationId: targetLocationId,
            type: "INITIAL_STOCK",
            quantityDelta: stock,
            operationId: `${marker}-init-stock-${tag}`,
            requestHash: hash(`init-stock-${tag}`),
            reasonCode: "INITIAL_STOCK",
            actorUserId: approver.id,
            resultingOnHand: stock,
          },
        });
      }
      return createdLevel;
    });
    return { prod, variant, offer: activeOffer, price, invItem, level };
  }

  const [origCatalog, subAffordable, subOverGross, subOverNet, subForeign] = await Promise.all([
    createCatalogOffer(store.id, location.id, "orig", "100.00", 0),
    createCatalogOffer(store.id, location.id, "sub50", "50.00", 2),
    createCatalogOffer(store.id, location.id, "sub105", "105.00", 2),
    createCatalogOffer(store.id, location.id, "sub91", "91.00", 2),
    createCatalogOffer(foreignStore.id, foreignLocation.id, "foreign50", "50.00", 2),
  ]);

  const policy = await prisma.storeOrderOperationalPolicy.create({
    data: {
      publicReference: `${marker}-policy`,
      name: marker,
      versionNumber: 1,
      status: "ACTIVE",
      acceptanceWindowSeconds: 900,
      customerDecisionWindowSeconds: 900,
      maximumPrepMinutes: 60,
      maximumPrepExtensionMinutes: 30,
      maximumIssueCount: 10,
      maximumSubstitutionProposalsPerLine: 5,
      substitutionMode: "CUSTOMER_APPROVAL_REQUIRED",
      timeoutOutcome: "REJECT_AND_REFUND",
      handoffVerificationMode: "TWO_PARTY_CHALLENGE",
      effectiveFrom: new Date(Date.now() - 60_000),
      approvedByUserId: approver.id,
      activatedAt: new Date(),
    },
  });

  const cart = await prisma.marketplaceCart.create({
    data: { publicReference: `${marker}-cart`, ownerType: "CUSTOMER", customerUserId: customer.id, status: "CHECKOUT_LOCKED" },
  });
  const checkout = await prisma.marketplaceCheckout.create({
    data: {
      publicReference: `${marker}-checkout`,
      cartId: cart.id,
      customerUserId: customer.id,
      status: "READY_FOR_REVIEW",
      reviewVersion: 1,
      merchandiseSubtotal: "100.00",
      promotionDiscount: "10.00",
      grandTotal: "90.00",
      digitalRequired: "90.00",
      commercialFingerprint: marker,
      acceptedFingerprint: marker,
      reviewAcceptedAt: new Date(),
    },
  });
  const group = await prisma.marketplaceCheckoutStoreGroup.create({
    data: {
      checkoutId: checkout.id,
      storeId: store.id,
      fulfilmentMode: "COURIER_DELIVERY",
      merchandiseSubtotal: "100.00",
      groupTotal: "100.00",
      paymentPlan: {
        version: "marketplace-payment-v1",
        mode: "DIGITAL_ONLY",
        authoritativeTotal: "90.00",
        digitalRequired: "90.00",
        cashRequired: "0.00",
        policyId: null,
        policyVersion: null,
        policyEvidence: null,
      },
    },
  });
  const checkoutLine = await prisma.marketplaceCheckoutLineSnapshot.create({
    data: {
      checkoutId: checkout.id,
      storeGroupId: group.id,
      reviewVersion: 1,
      productReference: origCatalog.prod.publicReference,
      variantReference: origCatalog.variant.publicReference,
      offerReference: origCatalog.offer.publicReference,
      storeReference: store.id,
      productTitle: origCatalog.prod.title,
      variantTitle: origCatalog.variant.title,
      quantity: 1,
      sellingUnit: "EACH",
      publicationVersion: "1",
      priceVersion: origCatalog.price.publicReference,
      baseUnitPrice: "100.00",
      modifierUnitTotal: "0.00",
      effectiveUnitPrice: "100.00",
      lineTotal: "100.00",
      taxTreatment: "INCLUDED",
    },
  });

  const campaign = await prisma.promotionCampaign.create({
    data: { publicReference: `${marker}-campaign`, internalCode: marker, ownerType: "PLATFORM", name: "Mixed Promo", status: "ACTIVE" },
  });
  const version = await prisma.promotionCampaignVersion.create({
    data: {
      campaignId: campaign.id,
      publicReference: `${marker}-version`,
      versionNumber: 1,
      status: "ACTIVE",
      applicationMethod: "AUTOMATIC",
      discountScope: "LINE",
      discountMechanism: "FIXED_AMOUNT",
      fixedAmount: 10,
      fundingType: "SHARED_PLATFORM_STORE",
      platformFundingShareBps: 6000,
      storeFundingShareBps: 4000,
      maximumRedemptionsGlobal: 5,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
    },
  });
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100 } });

  const allocation = {
    lineId: checkoutLine.id,
    basisAmount: amount("100.00"),
    discountAmount: amount("10.00"),
    platformFunding: amount("6.00"),
    storeFunding: amount("4.00"),
  };
  const applied: AppliedPromotion = {
    campaignVersionId: version.id,
    campaignId: campaign.id,
    publicReference: version.publicReference,
    applicationMethod: "AUTOMATIC",
    discountScope: "LINE",
    calculatedDiscount: amount("10.00"),
    fundingType: "SHARED",
    platformFundingShareBps: 6000,
    customerFacingTitle: "Mixed Promo",
    campaignName: "Mixed Promo",
    category: "AUTOMATIC_MERCHANDISE",
    allocations: [allocation],
    platformFunding: amount("6.00"),
    storeFunding: amount("4.00"),
  };
  const evaluation: PromotionEvaluationResult = {
    eligible: [applied],
    applied: [applied],
    rejected: [],
    stackingEvidence: { selectedPromotionIds: [version.id], rejectedPromotionIds: [], rejectionReasons: {} },
    totalDiscount: amount("10.00"),
    totalPlatformFunding: amount("6.00"),
    totalStoreFunding: amount("4.00"),
    allocations: [allocation],
  };

  const reserved = await prisma.$transaction((tx) =>
    reserveCheckoutPromotions(
      {
        checkoutId: checkout.id,
        checkoutReviewVersion: 1,
        customerUserId: customer.id,
        evaluationResult: evaluation,
        appliedPromotions: [applied],
        operationId: `${marker}-reserve`,
        requestHash: hash("reserve"),
        now: new Date(),
      },
      tx,
    ),
  );

  const platformWallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const cashAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
  const heldAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });
  const revenueAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-COMMISSION-REVENUE-ZAR", purpose: "PLATFORM_REVENUE", category: "REVENUE", currency: "ZAR" });
  const promoExpenseAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-PROMOTION-EXPENSE-ZAR", purpose: "PLATFORM_PROMOTION_EXPENSE", category: "EXPENSE", currency: "ZAR" });
  await ensureWalletForOwner({ ownerType: "STORE", ownerId: store.id, currency: "ZAR" });
  const storePayable = await ensureStoreEarningPayableAccount(store.id);
  await ensureCustomerRefundWallet(customer.id);

  const payRef = `PAY-${nonce}`;
  const providerPaymentRef = `ps_tx_${nonce.replaceAll("-", "")}`;
  const receipt = await postLedgerJournal({
    idempotencyKey: `${marker}-receipt`,
    sourceReference: `PROMOSUB:${nonce.replaceAll("-", "").toUpperCase()}`,
    correlationId: payRef,
    type: "EXTERNAL_PAYMENT_RECEIPT",
    currency: "ZAR",
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: cashAccount.id, direction: "DEBIT", amount: "90.00", lineCode: "CASH" },
      { accountId: heldAccount.id, direction: "CREDIT", amount: "90.00", lineCode: "HELD" },
    ],
  });

  const payment = await prisma.payment.create({
    data: {
      publicReference: payRef,
      userId: customer.id,
      marketplaceCheckoutId: checkout.id,
      subjectType: "MARKETPLACE_CHECKOUT",
      provider: "PAYSTACK",
      status: "PENDING",
      amount: "90.00",
      creationIdempotencyKey: `${marker}-payment`,
      creationRequestHash: hash("payment"),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      provider: "PAYSTACK",
      idempotencyKey: `${marker}-attempt`,
      requestHash: hash("attempt"),
      merchantReference: `${marker}-merchant`,
      providerReference: providerPaymentRef,
      status: "SUCCEEDED",
      amount: "90.00",
      currency: "ZAR",
      providerEnvironment: "SANDBOX",
      providerConfirmedAt: new Date(),
    },
  });
  const webhook = await prisma.paymentWebhookEvent.create({
    data: {
      publicReference: `pwe_${nonce}`,
      provider: "PAYSTACK",
      environment: "SANDBOX",
      eventFingerprint: hash("webhook"),
      merchantReference: attempt.merchantReference,
      providerStatus: "success",
      normalizedStatus: "COMPLETE",
      processingStatus: "APPLIED",
      paymentId: payment.id,
      attemptId: attempt.id,
      sourceAddressVerified: true,
      signatureVerified: true,
      merchantVerified: true,
      amountVerified: true,
      providerDataVerified: true,
      verifiedAt: new Date(),
      appliedAt: new Date(),
      ledgerJournalId: receipt.id,
    },
  });
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      successfulAttemptId: attempt.id,
      successWebhookEventId: webhook.id,
      successLedgerJournalId: receipt.id,
      providerConfirmedAt: new Date(),
      succeededAt: new Date(),
      version: { increment: 1 },
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      publicReference: `${marker}-order`,
      checkoutId: checkout.id,
      paymentId: payment.id,
      customerUserId: customer.id,
      merchandiseSubtotal: "100.00",
      modifierSubtotal: "0.00",
      deliveryFeeTotal: "0.00",
      promotionDiscount: "10.00",
      grandTotal: "90.00",
      digitalRequired: "90.00",
      commercialFingerprint: marker,
      status: "CONFIRMED",
    },
  });
  await prisma.payment.update({ where: { id: payment.id }, data: { marketplaceOrderId: order.id } });

  const committedPromo = await prisma.$transaction((tx) =>
    commitMarketplacePromotionRedemptions(
      {
        checkoutId: checkout.id,
        checkoutReviewVersion: 1,
        acknowledgementFingerprint: marker,
        paymentId: payment.id,
        paymentStatus: "SUCCEEDED",
        marketplaceOrderId: order.id,
        reservationIds: reserved.reservationIds,
        frozenEvaluation: evaluation,
        operationId: `${marker}-commit`,
        requestHash: hash("commit"),
        now: new Date(),
      },
      tx,
    ),
  );
  const redemptionId = committedPromo.redemptions[0].id;

  const storeOrder = await prisma.marketplaceStoreOrder.create({
    data: {
      publicReference: `${marker}-store-order`,
      marketplaceOrderId: order.id,
      checkoutStoreGroupId: group.id,
      storeId: store.id,
      status: "SETTLED",
      merchandiseSubtotal: "100.00",
      modifierSubtotal: "0.00",
      deliveryFee: "0.00",
      groupTotal: "100.00",
      operationalPolicyId: policy.id,
      operationalPolicyReference: policy.publicReference,
      operationalPolicyVersion: policy.versionNumber,
      operationalSnapshot: { policyReference: policy.publicReference, versionNumber: policy.versionNumber },
      reviewDeadlineAt: new Date(Date.now() + 600_000),
    },
  });

  const orderLine = await prisma.marketplaceOrderLine.create({
    data: {
      marketplaceStoreOrderId: storeOrder.id,
      checkoutLineSnapshotId: checkoutLine.id,
      productReference: checkoutLine.productReference,
      variantReference: checkoutLine.variantReference,
      offerReference: checkoutLine.offerReference,
      title: checkoutLine.productTitle,
      variantTitle: checkoutLine.variantTitle,
      quantity: 1,
      baseUnitPrice: "100.00",
      modifierUnitTotal: "0.00",
      effectiveUnitPrice: "100.00",
      lineTotal: "100.00",
      taxTreatment: "INCLUDED",
      fulfilment: {
        create: {
          publicReference: `${marker}-fulfilment`,
          marketplaceStoreOrderId: storeOrder.id,
          orderedQuantity: 1,
          status: "ORDERED",
          substitutionPreference: "REFUND_IF_UNAVAILABLE",
        },
      },
      financialAllocations: {
        create: [
          { type: "SELLER_BASIS", amount: "96.00", allocationVersion: "phase20-v1", roundingSequence: 1, finalCentRecipient: false },
          { type: "COMMISSION", amount: "9.60", allocationVersion: "phase20-v1", roundingSequence: 2, finalCentRecipient: false },
          { type: "STORE_EARNING", amount: "86.40", allocationVersion: "phase20-v1", roundingSequence: 3, finalCentRecipient: true },
        ],
      },
    },
  });

  const authoritativeAt = new Date().toISOString();
  const commissionPlan = await prisma.commissionPlan.create({
    data: {
      publicReference: `${marker}-cplan`,
      subjectType: "MARKETPLACE_STORE_ORDER",
      scopeKey: `STORE:${store.id}`,
      currency: "ZAR",
      versionNumber: 1,
      status: "ACTIVE",
      basisType: "ORDER_SUBTOTAL",
      effectiveFrom: new Date(Date.now() - 60_000),
      createdByUserId: approver.id,
      approvedByUserId: approver.id,
      approvedAt: new Date(),
      activatedAt: new Date(),
      calculationVersion: "phase14-v1",
      rules: {
        create: {
          publicReference: `${marker}-crule`,
          ruleCode: "PLATFORM_FEE",
          allocationType: "PLATFORM_COMMISSION_REVENUE",
          beneficiaryType: "PLATFORM",
          calculationMethod: "PERCENTAGE_BPS",
          rateBasisPoints: 1000,
          priority: 1,
        },
      },
    },
  });

  const settlementEvidence = await prisma.marketplaceCheckoutStoreSettlementEvidence.create({
    data: {
      publicReference: `${marker}-sev`,
      checkoutId: checkout.id,
      checkoutStoreGroupId: group.id,
      reviewVersion: 1,
      commercialFingerprint: marker,
      evidenceVersion: "phase20-v1",
      sellerIdentityReference: store.slug,
      sellerIdentityVersion: "1",
      sellerIdentityEvidence: {},
      commissionPlanReference: commissionPlan.publicReference,
      commissionPlanVersion: 1,
      commissionCalculationVersion: "phase14-v1",
      commissionEvidence: { beneficiaryAllocations: [] },
      sellerSettlementBasisAmount: "96.00",
      attributedCommissionAmount: "9.60",
      netStoreEarningAmount: "86.40",
      deliveryFeeExcludedAmount: "0.00",
      taxEvidence: {},
      policyReferences: {},
      sourceEvidenceFingerprint: marker,
    },
  });

  const settlementSnapshot = await prisma.marketplaceSettlementSnapshot.create({
    data: {
      publicReference: `${marker}-settle`,
      marketplaceStoreOrderId: storeOrder.id,
      sourceCheckoutId: checkout.id,
      sourceCheckoutReviewVersion: 1,
      sourceCheckoutStoreGroupId: group.id,
      sourceSettlementEvidenceId: settlementEvidence.id,
      sourceCommercialFingerprint: marker,
      sourcePaymentId: payment.id,
      settlementVersion: "phase20-v1",
      commissionPlanReference: commissionPlan.publicReference,
      commissionPlanVersion: "1",
      sellerBasis: "96.00",
      commissionAmount: "9.60",
      storeEarningAmount: "86.40",
      deliveryFeeResidual: "0.00",
      currency: "ZAR",
      authoritativeAt: new Date(authoritativeAt),
      status: "PENDING",
      sourceEvidenceFingerprint: marker,
    },
  });

  const settled = await prisma.$transaction(
    async (tx) => {
      const comm = await accrueCommissionInTransaction(
        tx,
        {
          subjectType: "MARKETPLACE_STORE_ORDER",
          subjectId: storeOrder.id,
          subjectPublicReference: storeOrder.publicReference,
          settlementVersion: "phase20-v1",
          scopeKey: `STORE:${store.id}`,
          authoritativeAt,
          basis: {
            subjectType: "MARKETPLACE_STORE_ORDER",
            subjectId: storeOrder.id,
            subjectPublicReference: storeOrder.publicReference,
            pricingReference: settlementSnapshot.publicReference,
            pricingVersion: "phase20-v1",
            subtotal: "96.00",
            tax: "0.00",
            total: "96.00",
            currency: "ZAR",
            authoritativeAt,
          },
          planPublicReference: commissionPlan.publicReference,
          planVersionNumber: 1,
          beneficiarySnapshots: [],
        },
        { operationId: `${marker}:settle:comm` },
      );
      const earn = await accrueStoreEarningInTransaction(
        tx,
        {
          subjectType: "MARKETPLACE_ORDER",
          subjectId: order.id,
          subjectPublicReference: order.publicReference,
          storeId: store.id,
          storePublicReference: store.slug,
          walletId: storePayable.wallet.id,
          paymentId: payment.id,
          paymentPublicReference: payment.publicReference,
          settlementReference: settlementSnapshot.publicReference,
          settlementVersion: "phase20-v1",
          calculationVersion: "phase20-frozen-v1",
          authoritativeAt,
          sellerSettlementBasisAmount: "96.00",
          attributedCommissionAmount: "9.60",
          netStoreEarningAmount: "86.40",
          currency: "ZAR",
          commissionCharges: comm.allocationEvidence.map((a) => ({
            commissionAllocationId: a.id,
            commissionAllocationPublicReference: a.publicReference,
            amount: a.amount,
            currency: "ZAR" as const,
          })),
        },
        comm.allocationEvidence,
        { operationId: `${marker}:settle:earn`, commissionSubjectId: storeOrder.id, payableAccountId: storePayable.account.id },
      );
      await tx.marketplaceSettlementSnapshot.update({
        where: { id: settlementSnapshot.id },
        data: {
          status: "COMPLETED",
          commissionAccrualReference: comm.publicReference,
          storeEarningReference: earn.publicReference,
          settledAt: new Date(),
        },
      });
      return { comm, earn };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  // Begin review, mark item out of stock, set CONTACT_ME preference
  await beginStoreOrderReview({
    storeOrderReference: storeOrder.publicReference,
    actorUserId: storeOwner.id,
    operationId: `${marker}-begin-review`,
    requestHash: hash("begin-review"),
    testApproval: { approved: true },
  });

  await updateStoreOrderSubstitutionPreference({
    storeOrderReference: storeOrder.publicReference,
    orderLineId: orderLine.id,
    preference: "CONTACT_ME",
    customerUserId: customer.id,
    operationId: `${marker}-pref-contact`,
    requestHash: hash("pref-contact"),
    testApproval: { approved: true },
  });

  const availResult = await confirmStoreOrderLineAvailability({
    storeOrderReference: storeOrder.publicReference,
    actorUserId: storeOwner.id,
    orderLineId: orderLine.id,
    availableQuantity: 0,
    reasonCode: "OUT_OF_STOCK",
    operationId: `${marker}-avail-0`,
    requestHash: hash("avail-0"),
    testApproval: { approved: true },
  });
  const issueReference = String((availResult as { issueReference?: string }).issueReference);

  // Negative variant 1: Cross-store substitution rejected
  await expect(
    proposeStoreOrderSubstitution({
      storeOrderReference: storeOrder.publicReference,
      actorUserId: storeOwner.id,
      issueReference,
      substituteOfferReference: subForeign.offer.publicReference,
      substituteVariantReference: subForeign.variant.publicReference,
      quantity: 1,
      operationId: `${marker}-sub-foreign`,
      requestHash: hash("sub-foreign"),
      testApproval: { approved: true },
    }),
  ).rejects.toMatchObject({ code: "STORE_ORDER_SUBSTITUTION_CROSS_STORE" });

  // Negative variant 2: Over-priced replacement (> gross 100.00) rejected on proposal
  await expect(
    proposeStoreOrderSubstitution({
      storeOrderReference: storeOrder.publicReference,
      actorUserId: storeOwner.id,
      issueReference,
      substituteOfferReference: subOverGross.offer.publicReference,
      substituteVariantReference: subOverGross.variant.publicReference,
      quantity: 1,
      operationId: `${marker}-sub-105`,
      requestHash: hash("sub-105"),
      testApproval: { approved: true },
    }),
  ).rejects.toMatchObject({ code: "STORE_ORDER_SUBSTITUTION_PRICE_CAP" });

  // Negative variant 3: Replacement > customer net paid after discount (91.00 > 90.00) rejected on approval
  const proposed91 = await proposeStoreOrderSubstitution({
    storeOrderReference: storeOrder.publicReference,
    actorUserId: storeOwner.id,
    issueReference,
    substituteOfferReference: subOverNet.offer.publicReference,
    substituteVariantReference: subOverNet.variant.publicReference,
    quantity: 1,
    operationId: `${marker}-sub-91`,
    requestHash: hash("sub-91"),
    testApproval: { approved: true },
  });
  const proposalRef91 = String((proposed91 as { proposalReference?: string }).proposalReference);
  await expect(
    decideStoreOrderSubstitution({
      storeOrderReference: storeOrder.publicReference,
      proposalReference: proposalRef91,
      decision: "APPROVE",
      customerUserId: customer.id,
      operationId: `${marker}-approve-91`,
      requestHash: hash("approve-91"),
      testApproval: { approved: true },
    }),
  ).rejects.toMatchObject({ code: "STORE_ORDER_SUBSTITUTION_PRICE_CAP" });
  expect(await prisma.marketplaceStoreOrderAdjustment.count({ where: { marketplaceStoreOrderId: storeOrder.id } })).toBe(0);

  // Expire the unapprovable 91.00 proposal and release its temporary hold before proposing the affordable 50.00 replacement
  await prisma.$transaction(async (tx) => {
    const prop91 = await tx.marketplaceStoreOrderSubstitutionProposal.findUniqueOrThrow({
      where: { publicReference: proposalRef91 },
      include: { reservation: true },
    });
    await tx.marketplaceStoreOrderSubstitutionProposal.update({ where: { id: prop91.id }, data: { status: "EXPIRED" } });
    if (prop91.reservation) {
      await tx.marketplaceStoreOrderSubstitutionReservation.update({
        where: { id: prop91.reservation.id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      await tx.catalogInventoryLevel.update({
        where: { id: prop91.reservation.inventoryLevelId },
        data: { reserved: { decrement: 1 }, available: { increment: 1 } },
      });
    }
  });

  // Positive path: Propose and approve affordable 50.00 replacement
  const proposed50 = await proposeStoreOrderSubstitution({
    storeOrderReference: storeOrder.publicReference,
    actorUserId: storeOwner.id,
    issueReference,
    substituteOfferReference: subAffordable.offer.publicReference,
    substituteVariantReference: subAffordable.variant.publicReference,
    quantity: 1,
    operationId: `${marker}-sub-50`,
    requestHash: hash("sub-50"),
    testApproval: { approved: true },
  });
  const proposalRef50 = String((proposed50 as { proposalReference?: string }).proposalReference);

  const approved50 = await decideStoreOrderSubstitution({
    storeOrderReference: storeOrder.publicReference,
    proposalReference: proposalRef50,
    decision: "APPROVE",
    customerUserId: customer.id,
    operationId: `${marker}-approve-50`,
    requestHash: hash("approve-50"),
    testApproval: { approved: true },
  });

  const adjustmentsAfterApproval = await prisma.marketplaceStoreOrderAdjustment.findMany({
    where: { marketplaceStoreOrderId: storeOrder.id },
    include: { allocations: true },
  });
  expect(adjustmentsAfterApproval).toHaveLength(1);
  const createdAdjustment = adjustmentsAfterApproval[0];
  expect(createdAdjustment.publicReference).toBe((approved50 as { adjustmentReference?: string }).adjustmentReference);
  expect(createdAdjustment.refundAmount.toFixed(2)).toBe("40.00");
  expect((createdAdjustment.financialEvidence as Record<string, unknown>)?.platformSubsidyReversal).toBe("6.00");
  expect(createdAdjustment.allocations.find((a) => a.allocationType === "SELLER_BASIS")?.amount.toFixed(2)).toBe("46.00");
  expect(createdAdjustment.allocations.find((a) => a.allocationType === "COMMISSION")?.amount.toFixed(2)).toBe("4.60");
  expect(createdAdjustment.allocations.find((a) => a.allocationType === "STORE_EARNING")?.amount.toFixed(2)).toBe("41.40");

  const levelAfterApproval = await prisma.catalogInventoryLevel.findUniqueOrThrow({ where: { id: subAffordable.level.id } });
  expect(levelAfterApproval).toMatchObject({ onHand: 1, reserved: 0, available: 1 });

  // Apply financial adjustment (reverses commission 4.60, store earning 41.40, platform subsidy 6.00, promotion budget 10.00, reserves 40.00 refund)
  const paystackClient = new DisposablePromotionRefundPaystackClient(providerPaymentRef);
  const registry = new RefundProviderRegistry([new PaystackRefundAdapter(paystackClient)]);
  const refundDeps = {
    assertProductionReady: () => requireDisposableStoreSettlementDatabase(),
    registry,
    providerRegistry: registry,
  };
  const financialAuthority = new ExistingPhaseFinancialAdjustmentAuthority(refundDeps);

  const appliedAdj = await applyMarketplaceStoreOrderAdjustment({
    storeOrderReference: storeOrder.publicReference,
    adjustmentReference: createdAdjustment.publicReference,
    actorUserId: storeOwner.id,
    operationId: `${marker}-apply-adj`,
    requestHash: hash("apply-adj"),
    dependencies: { financialAuthority },
    testApproval: { approved: true },
  });
  expect((appliedAdj as { financialStatus?: string }).financialStatus).toBe("REFUND_RESERVED");
  expect(String((appliedAdj as { refundReference?: string }).refundReference)).toMatch(/^RF-/);

  const refundReference = String((appliedAdj as { refundReference?: string }).refundReference);
  await approveRefund({
    actorUserId: approver.id,
    publicReference: refundReference,
    operationId: `${marker}:refund-approve`,
    financeNote: "Approved mixed-discount substitution refund",
  });

  // Negative variant 4a: Uncompleted refund rejected by applyPromotionRefundAdjustment
  const refundRowBeforeExec = await prisma.paymentRefund.findUniqueOrThrow({ where: { publicReference: refundReference } });
  await expect(
    prisma.$transaction((tx) =>
      applyPromotionRefundAdjustment(
        {
          refundId: refundRowBeforeExec.id,
          storeOrderId: storeOrder.id,
          lineReference: checkoutLine.id,
          refundProportion: amount("1"),
          lineTotal: amount("100.00"),
          frozenPromotionAllocations: committedPromo.allocations,
          redemptionId,
          operationId: `${marker}-uncompleted-refund`,
          requestHash: hash("uncompleted-refund"),
        },
        tx,
      ),
    ),
  ).rejects.toThrow("Verified refund payment evidence is required");

  // Execute provider refund
  const executedRefund = await startProviderRefund(
    {
      actorUserId: processor.id,
      publicReference: refundReference,
      operationId: `${marker}:refund-exec`,
    },
    refundDeps,
  );
  expect(executedRefund.status).toBe("SUCCEEDED");
  expect(paystackClient.calls).toBe(1);

  // Negative variant 4b: Mismatched lineTotal / amount rejected even after refund succeeded
  await expect(
    prisma.$transaction((tx) =>
      applyPromotionRefundAdjustment(
        {
          refundId: refundRowBeforeExec.id,
          storeOrderId: storeOrder.id,
          lineReference: checkoutLine.id,
          refundProportion: amount("1"),
          lineTotal: amount("99.00"),
          frozenPromotionAllocations: committedPromo.allocations,
          redemptionId,
          operationId: `${marker}-wrong-amount-after`,
          requestHash: hash("wrong-amount-after"),
        },
        tx,
      ),
    ),
  ).rejects.toThrow("Refund quantities do not match the frozen order");

  // Verify adjustment and store order resolution completed
  const completedAdjustment = await prisma.marketplaceStoreOrderAdjustment.findUniqueOrThrow({
    where: { id: createdAdjustment.id },
    include: { allocations: true },
  });
  expect(completedAdjustment.status).toBe("COMPLETED");
  const resolvedStoreOrder = await prisma.marketplaceStoreOrder.findUniqueOrThrow({ where: { id: storeOrder.id } });
  expect(resolvedStoreOrder.resolutionStatus).toBe("RESOLVED");

  // Verify promotion budget & redemption state after adjustment
  const budgetAfter = await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } });
  expect(budgetAfter.committedAmount.toFixed(2)).toBe("10.00");
  expect(budgetAfter.reversedAmount.toFixed(2)).toBe("10.00");
  const redemptionAfter = await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: redemptionId } });
  expect(redemptionAfter.status).toBe("FULLY_REVERSED");
  expect(await prisma.promotionBudgetMovement.count({ where: { redemptionId, movementType: "REVERSE" } })).toBe(1);

  // Verify StoreEarning & CommissionAccrual conservation
  const earningAfter = await prisma.storeEarning.findUniqueOrThrow({ where: { publicReference: settled.earn.publicReference } });
  expect(earningAfter.amount.toFixed(2)).toBe("86.40");
  expect(earningAfter.reversedAmount.toFixed(2)).toBe("41.40");
  expect(earningAfter.amount.sub(earningAfter.reversedAmount).toFixed(2)).toBe("45.00");

  const commRevJournals = await prisma.ledgerJournal.findMany({
    where: {
      type: "ACCOUNT_TRANSFER",
      metadata: { path: ["accrualReference"], equals: settled.comm.publicReference },
      entries: { some: { lineCode: "COMMISSION_ADJUSTMENT_REVERSAL" } },
    },
  });
  expect(commRevJournals).toHaveLength(1);
  expect(commRevJournals[0].totalDebits.toFixed(2)).toBe("4.60");

  const subsidyRevJournal = await prisma.ledgerJournal.findUniqueOrThrow({
    where: { idempotencyKey: `LJ-PROMO-REV-${createdAdjustment.id}` },
  });
  expect(subsidyRevJournal.totalDebits.toFixed(2)).toBe("6.00");
  expect(subsidyRevJournal.totalCredits.toFixed(2)).toBe("6.00");

  // Repeat operations to prove zero additional refund, credit, journal, or budget reversal
  const replayApproveSub = await decideStoreOrderSubstitution({
    storeOrderReference: storeOrder.publicReference,
    proposalReference: proposalRef50,
    decision: "APPROVE",
    customerUserId: customer.id,
    operationId: `${marker}-approve-50`,
    requestHash: hash("approve-50"),
    testApproval: { approved: true },
  });
  expect(replayApproveSub.replayed).toBe(true);

  const replayApplyAdj = await applyMarketplaceStoreOrderAdjustment({
    storeOrderReference: storeOrder.publicReference,
    adjustmentReference: createdAdjustment.publicReference,
    actorUserId: storeOwner.id,
    operationId: `${marker}-apply-adj`,
    requestHash: hash("apply-adj"),
    dependencies: { financialAuthority },
    testApproval: { approved: true },
  });
  expect(replayApplyAdj.replayed).toBe(true);

  const replayExecRefund = await startProviderRefund(
    {
      actorUserId: processor.id,
      publicReference: refundReference,
      operationId: `${marker}:refund-exec`,
    },
    refundDeps,
  );
  expect(replayExecRefund.status).toBe("SUCCEEDED");
  expect(paystackClient.calls).toBe(1);

  const replayPromoRefund = await prisma.$transaction((tx) =>
    applyPromotionRefundAdjustment(
      {
        refundId: refundRowBeforeExec.id,
        storeOrderId: storeOrder.id,
        lineReference: checkoutLine.id,
        refundProportion: amount("1"),
        lineTotal: amount("100.00"),
        frozenPromotionAllocations: committedPromo.allocations,
        redemptionId,
        operationId: `promo-adj-rev:${createdAdjustment.id}:${redemptionId}`,
        requestHash: hash("promo-refund-replay"),
      },
      tx,
    ),
  );
  expect(replayPromoRefund.customerRefundAmount.toFixed(2)).toBe("40.00");
  expect(replayPromoRefund.platformSubventionReversal.toFixed(2)).toBe("6.00");
  expect(replayPromoRefund.storeBasisReversal.toFixed(2)).toBe("4.00");
  expect(replayPromoRefund.budgetReversalAmount.toFixed(2)).toBe("10.00");

  const recoveryReplay = await recoverPromotionReversals({
    limit: 5,
    after: createdAdjustment.id.slice(0, -1),
    apply: true,
  });
  expect(recoveryReplay.failed).toBe(0);

  // Confirm zero duplicate records across all tables
  expect(await prisma.marketplaceStoreOrderAdjustment.count({ where: { marketplaceStoreOrderId: storeOrder.id } })).toBe(1);
  expect(await prisma.paymentRefund.count({ where: { paymentId: payment.id } })).toBe(1);
  expect(await prisma.promotionBudgetMovement.count({ where: { redemptionId, movementType: "REVERSE" } })).toBe(1);
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).reversedAmount.toFixed(2)).toBe("10.00");
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).totalRefundedAmount.toFixed(2)).toBe("40.00");
  expect((await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).totalRefundReservedAmount.toFixed(2)).toBe("0.00");

  // Confirm promotional expense account net movement is 0.00 (6.00 debit on commit, 6.00 credit on reversal)
  const promoEntries = await prisma.ledgerEntry.findMany({
    where: {
      accountId: promoExpenseAccount.id,
      journal: { idempotencyKey: { in: [`LJ-PROMO-${redemptionId}`, `LJ-PROMO-REV-${createdAdjustment.id}`] } },
    },
  });
  expect(promoEntries).toHaveLength(2);
  const promoDebit = promoEntries.filter((e) => e.direction === "DEBIT").reduce((s, e) => s.add(e.amount), amount("0.00"));
  const promoCredit = promoEntries.filter((e) => e.direction === "CREDIT").reduce((s, e) => s.add(e.amount), amount("0.00"));
  expect(promoDebit.toFixed(2)).toBe("6.00");
  expect(promoCredit.toFixed(2)).toBe("6.00");
  expect(revenueAccount.id).toBeTruthy();
}, 60_000);

it("recovers multi-line promotion reversals on PostgreSQL and keeps delivery-fee adjustments review-required (E1)", async () => {
  const nonce = randomUUID();
  const marker = `promo-ml-${nonce}`;
  const hash = (tag: string) => createHash("sha256").update(`${marker}:${tag}`).digest("hex");
  const amount = (v: string) => new Prisma.Decimal(v);

  const customer = await prisma.user.create({ data: { email: `${marker}@example.test`, role: "CUSTOMER", status: "ACTIVE" } });
  const store = await prisma.store.create({ data: { name: "Multi-line Promo Store", slug: marker, status: "ACTIVE" } });
  const cart = await prisma.marketplaceCart.create({
    data: { publicReference: `${marker}-cart`, ownerType: "CUSTOMER", customerUserId: customer.id, status: "CHECKOUT_LOCKED" },
  });
  const checkout = await prisma.marketplaceCheckout.create({
    data: {
      publicReference: `${marker}-checkout`,
      cartId: cart.id,
      customerUserId: customer.id,
      status: "READY_FOR_REVIEW",
      reviewVersion: 1,
      merchandiseSubtotal: "150.00",
      promotionDiscount: "15.00",
      grandTotal: "135.00",
      digitalRequired: "135.00",
      commercialFingerprint: marker,
      acceptedFingerprint: marker,
      reviewAcceptedAt: new Date(),
    },
  });
  const group = await prisma.marketplaceCheckoutStoreGroup.create({
    data: {
      checkoutId: checkout.id,
      storeId: store.id,
      fulfilmentMode: "COURIER_DELIVERY",
      merchandiseSubtotal: "150.00",
      groupTotal: "150.00",
    },
  });

  const [snapLine1, snapLine2] = await Promise.all([
    prisma.marketplaceCheckoutLineSnapshot.create({
      data: {
        checkoutId: checkout.id,
        storeGroupId: group.id,
        reviewVersion: 1,
        productReference: `${marker}-p1`,
        variantReference: `${marker}-v1`,
        offerReference: `${marker}-o1`,
        storeReference: store.id,
        productTitle: "Item 1",
        variantTitle: "Default",
        quantity: 2,
        sellingUnit: "EACH",
        publicationVersion: "1",
        priceVersion: "1",
        baseUnitPrice: "50.00",
        modifierUnitTotal: "0.00",
        effectiveUnitPrice: "50.00",
        lineTotal: "100.00",
        taxTreatment: "INCLUDED",
      },
    }),
    prisma.marketplaceCheckoutLineSnapshot.create({
      data: {
        checkoutId: checkout.id,
        storeGroupId: group.id,
        reviewVersion: 1,
        productReference: `${marker}-p2`,
        variantReference: `${marker}-v2`,
        offerReference: `${marker}-o2`,
        storeReference: store.id,
        productTitle: "Item 2",
        variantTitle: "Default",
        quantity: 1,
        sellingUnit: "EACH",
        publicationVersion: "1",
        priceVersion: "1",
        baseUnitPrice: "50.00",
        modifierUnitTotal: "0.00",
        effectiveUnitPrice: "50.00",
        lineTotal: "50.00",
        taxTreatment: "INCLUDED",
      },
    }),
  ]);

  const campaign = await prisma.promotionCampaign.create({
    data: { publicReference: `${marker}-campaign`, internalCode: marker, ownerType: "PLATFORM", name: "Multi-line Promo", status: "ACTIVE" },
  });
  const version = await prisma.promotionCampaignVersion.create({
    data: {
      campaignId: campaign.id,
      publicReference: `${marker}-version`,
      versionNumber: 1,
      status: "ACTIVE",
      applicationMethod: "AUTOMATIC",
      discountScope: "ORDER",
      discountMechanism: "FIXED_AMOUNT",
      fixedAmount: 15,
      fundingType: "SHARED_PLATFORM_STORE",
      platformFundingShareBps: 6000,
      storeFundingShareBps: 4000,
      maximumRedemptionsGlobal: 5,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 86_400_000),
    },
  });
  const budget = await prisma.promotionBudget.create({ data: { campaignVersionId: version.id, approvedAmount: 100 } });

  const allocations = [
    { lineId: snapLine1.id, basisAmount: amount("100.00"), discountAmount: amount("10.00"), platformFunding: amount("6.00"), storeFunding: amount("4.00") },
    { lineId: snapLine2.id, basisAmount: amount("50.00"), discountAmount: amount("5.00"), platformFunding: amount("3.00"), storeFunding: amount("2.00") },
  ];
  const applied: AppliedPromotion = {
    campaignVersionId: version.id,
    campaignId: campaign.id,
    publicReference: version.publicReference,
    applicationMethod: "AUTOMATIC",
    discountScope: "ORDER",
    calculatedDiscount: amount("15.00"),
    fundingType: "SHARED",
    platformFundingShareBps: 6000,
    customerFacingTitle: "Multi-line Promo",
    campaignName: "Multi-line Promo",
    category: "AUTOMATIC_MERCHANDISE",
    allocations,
    platformFunding: amount("9.00"),
    storeFunding: amount("6.00"),
  };
  const evaluation: PromotionEvaluationResult = {
    eligible: [applied],
    applied: [applied],
    rejected: [],
    stackingEvidence: { selectedPromotionIds: [version.id], rejectedPromotionIds: [], rejectionReasons: {} },
    totalDiscount: amount("15.00"),
    totalPlatformFunding: amount("9.00"),
    totalStoreFunding: amount("6.00"),
    allocations,
  };

  const reserved = await prisma.$transaction((tx) =>
    reserveCheckoutPromotions(
      {
        checkoutId: checkout.id,
        checkoutReviewVersion: 1,
        customerUserId: customer.id,
        evaluationResult: evaluation,
        appliedPromotions: [applied],
        operationId: `${marker}-reserve`,
        requestHash: hash("reserve"),
        now: new Date(),
      },
      tx,
    ),
  );

  const platformWallet = await ensureWalletForOwner({ ownerType: "PLATFORM", ownerId: "platform", currency: "ZAR" });
  const cashAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CASH-CLEARING-ZAR", purpose: "CASH_CLEARING", category: "ASSET", currency: "ZAR" });
  const heldAccount = await ensureLedgerAccount({ walletId: platformWallet.id, code: "PLATFORM-CUSTOMER-FUNDS-HELD-ZAR", purpose: "HELD", category: "LIABILITY", currency: "ZAR" });

  const payRef = `PAY-${nonce}`;
  const receipt = await postLedgerJournal({
    idempotencyKey: `${marker}-receipt`,
    sourceReference: `PROMOML:${nonce.replaceAll("-", "").toUpperCase()}`,
    correlationId: payRef,
    type: "EXTERNAL_PAYMENT_RECEIPT",
    currency: "ZAR",
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: cashAccount.id, direction: "DEBIT", amount: "135.00", lineCode: "CASH" },
      { accountId: heldAccount.id, direction: "CREDIT", amount: "135.00", lineCode: "HELD" },
    ],
  });
  const payment = await prisma.payment.create({
    data: {
      publicReference: payRef,
      userId: customer.id,
      marketplaceCheckoutId: checkout.id,
      subjectType: "MARKETPLACE_CHECKOUT",
      provider: "PAYSTACK",
      status: "PENDING",
      amount: "135.00",
      creationIdempotencyKey: `${marker}-payment`,
      creationRequestHash: hash("payment"),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      provider: "PAYSTACK",
      idempotencyKey: `${marker}-attempt`,
      requestHash: hash("attempt"),
      merchantReference: `${marker}-merchant`,
      status: "SUCCEEDED",
      amount: "135.00",
      currency: "ZAR",
      providerEnvironment: "SANDBOX",
      providerConfirmedAt: new Date(),
    },
  });
  const webhook = await prisma.paymentWebhookEvent.create({
    data: {
      publicReference: `pwe_${nonce}`,
      provider: "PAYSTACK",
      environment: "SANDBOX",
      eventFingerprint: hash("webhook"),
      merchantReference: attempt.merchantReference,
      providerStatus: "success",
      normalizedStatus: "COMPLETE",
      processingStatus: "APPLIED",
      paymentId: payment.id,
      attemptId: attempt.id,
      sourceAddressVerified: true,
      signatureVerified: true,
      merchantVerified: true,
      amountVerified: true,
      providerDataVerified: true,
      verifiedAt: new Date(),
      appliedAt: new Date(),
      ledgerJournalId: receipt.id,
    },
  });
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: "SUCCEEDED",
      successfulAttemptId: attempt.id,
      successWebhookEventId: webhook.id,
      successLedgerJournalId: receipt.id,
      providerConfirmedAt: new Date(),
      succeededAt: new Date(),
      version: { increment: 1 },
    },
  });

  const order = await prisma.marketplaceOrder.create({
    data: {
      publicReference: `${marker}-order`,
      checkoutId: checkout.id,
      paymentId: payment.id,
      customerUserId: customer.id,
      merchandiseSubtotal: "150.00",
      modifierSubtotal: "0.00",
      deliveryFeeTotal: "0.00",
      promotionDiscount: "15.00",
      grandTotal: "135.00",
      digitalRequired: "135.00",
      commercialFingerprint: marker,
      status: "CONFIRMED",
    },
  });

  const committed = await prisma.$transaction((tx) =>
    commitMarketplacePromotionRedemptions(
      {
        checkoutId: checkout.id,
        checkoutReviewVersion: 1,
        acknowledgementFingerprint: marker,
        paymentId: payment.id,
        paymentStatus: "SUCCEEDED",
        marketplaceOrderId: order.id,
        reservationIds: reserved.reservationIds,
        frozenEvaluation: evaluation,
        operationId: `${marker}-commit`,
        requestHash: hash("commit"),
        now: new Date(),
      },
      tx,
    ),
  );
  const redemptionId = committed.redemptions[0].id;

  const storeOrder = await prisma.marketplaceStoreOrder.create({
    data: {
      publicReference: `${marker}-store-order`,
      marketplaceOrderId: order.id,
      checkoutStoreGroupId: group.id,
      storeId: store.id,
      merchandiseSubtotal: "150.00",
      modifierSubtotal: "0.00",
      deliveryFee: "0.00",
      groupTotal: "150.00",
    },
  });

  const [orderLine1, orderLine2] = await Promise.all([
    prisma.marketplaceOrderLine.create({
      data: {
        marketplaceStoreOrderId: storeOrder.id,
        checkoutLineSnapshotId: snapLine1.id,
        productReference: snapLine1.productReference,
        variantReference: snapLine1.variantReference,
        offerReference: snapLine1.offerReference,
        title: "Item 1",
        variantTitle: "Default",
        quantity: 2,
        baseUnitPrice: "50.00",
        modifierUnitTotal: "0.00",
        effectiveUnitPrice: "50.00",
        lineTotal: "100.00",
        taxTreatment: "INCLUDED",
      },
    }),
    prisma.marketplaceOrderLine.create({
      data: {
        marketplaceStoreOrderId: storeOrder.id,
        checkoutLineSnapshotId: snapLine2.id,
        productReference: snapLine2.productReference,
        variantReference: snapLine2.variantReference,
        offerReference: snapLine2.offerReference,
        title: "Item 2",
        variantTitle: "Default",
        quantity: 1,
        baseUnitPrice: "50.00",
        modifierUnitTotal: "0.00",
        effectiveUnitPrice: "50.00",
        lineTotal: "50.00",
        taxTreatment: "INCLUDED",
      },
    }),
  ]);

  // Create balanced reserve and completion journals and succeeded PaymentRefund for the 2-line adjustment (45.00 + 45.00 = 90.00)
  const customerRefundWallet = await ensureCustomerRefundWallet(customer.id);
  const reserveJournal = await postLedgerJournal({
    idempotencyKey: `${marker}-refund-reserve`,
    sourceReference: `PROMOMLRESERVE:${nonce.replaceAll("-", "").toUpperCase()}`,
    correlationId: `${marker}-refund`,
    type: "REFUND_RESERVE",
    currency: "ZAR",
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: heldAccount.id, direction: "DEBIT", amount: "90.00", lineCode: "HELD_OUT" },
      { accountId: customerRefundWallet.refundHeld.id, direction: "CREDIT", amount: "90.00", lineCode: "REFUND_HELD_IN" },
    ],
  });
  const payoutJournal = await postLedgerJournal({
    idempotencyKey: `${marker}-refund-payout`,
    sourceReference: `PROMOMLPAYOUT:${nonce.replaceAll("-", "").toUpperCase()}`,
    correlationId: `${marker}-refund`,
    type: "REFUND_WALLET_CREDIT",
    currency: "ZAR",
    actor: { kind: "SYSTEM" },
    entries: [
      { accountId: customerRefundWallet.refundHeld.id, direction: "DEBIT", amount: "90.00", lineCode: "REFUND_HELD" },
      { accountId: customerRefundWallet.available.id, direction: "CREDIT", amount: "90.00", lineCode: "WALLET_IN" },
    ],
  });

  const multiLineRefund = await prisma.$transaction(async (tx) => {
    const createdRefund = await tx.paymentRefund.create({
      data: {
        publicReference: `RF-ML-${nonce.replaceAll("-", "").toUpperCase()}`,
        paymentId: payment.id,
        customerUserId: customer.id,
        method: "CUSTOMER_WALLET",
        amount: "90.00",
        currency: "ZAR",
        status: "SUCCEEDED",
        reasonCode: "SERVICE_NOT_PROVIDED",
        creationIdempotencyKey: `${marker}-rf-create`,
        creationRequestHash: hash("rf-create"),
        policyVersion: 1,
        reserveLedgerJournalId: reserveJournal.id,
        completionLedgerJournalId: payoutJournal.id,
        completedAt: new Date(),
        fundingAllocations: {
          create: {
            publicReference: `RFA-ML-${nonce.replaceAll("-", "").toUpperCase()}`,
            sourceType: "CUSTOMER_FUNDS_HELD",
            ledgerAccountId: heldAccount.id,
            amount: "90.00",
            currency: "ZAR",
          },
        },
      },
    });
    await tx.payment.update({
      where: { id: payment.id },
      data: { totalRefundedAmount: "90.00", version: { increment: 1 } },
    });
    return createdRefund;
  });

  // Create 2 adjustments with deterministic IDs so we can cursor-scan just these two:
  // 1) Valid 2-line adjustment (line 1: 1 of 2 refunded -> sellerBasis 48.00, customer refund 45.00; line 2: 1 of 1 refunded -> sellerBasis 48.00, customer refund 45.00)
  // 2) Delivery-fee adjustment (deliveryFeeAmount: 15.00) which must remain review-required
  const prefix = `zml_${nonce.replaceAll("-", "").slice(0, 16)}`;
  const validAdjId = `${prefix}_1_valid`;
  const feeAdjId = `${prefix}_2_fee`;

  await prisma.marketplaceStoreOrderAdjustment.create({
    data: {
      id: validAdjId,
      publicReference: `${marker}-adj-valid`,
      marketplaceStoreOrderId: storeOrder.id,
      adjustmentType: "QUANTITY_REDUCTION",
      status: "COMPLETED",
      reasonCode: "CUSTOMER_SUBSTITUTION_PREFERENCE_REFUND",
      sourceVersion: "phase20-v1",
      operationId: `${marker}-adj-valid-op`,
      requestHash: hash("adj-valid-op"),
      refundAmount: "90.00",
      deliveryFeeAmount: "0.00",
      refundId: multiLineRefund.id,
      completedAt: new Date(),
      allocations: {
        create: [
          {
            marketplaceOrderLineId: orderLine1.id,
            allocationType: "SELLER_BASIS",
            amount: "48.00",
            originalQuantity: 2,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 1,
          },
          {
            marketplaceOrderLineId: orderLine1.id,
            allocationType: "COMMISSION",
            amount: "4.80",
            originalQuantity: 2,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 2,
          },
          {
            marketplaceOrderLineId: orderLine1.id,
            allocationType: "STORE_EARNING",
            amount: "43.20",
            originalQuantity: 2,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 3,
          },
          {
            marketplaceOrderLineId: orderLine2.id,
            allocationType: "SELLER_BASIS",
            amount: "48.00",
            originalQuantity: 1,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 4,
          },
          {
            marketplaceOrderLineId: orderLine2.id,
            allocationType: "COMMISSION",
            amount: "4.80",
            originalQuantity: 1,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 5,
          },
          {
            marketplaceOrderLineId: orderLine2.id,
            allocationType: "STORE_EARNING",
            amount: "43.20",
            originalQuantity: 1,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 6,
          },
        ],
      },
    },
  });

  await prisma.marketplaceStoreOrderAdjustment.create({
    data: {
      id: feeAdjId,
      publicReference: `${marker}-adj-fee`,
      marketplaceStoreOrderId: storeOrder.id,
      adjustmentType: "FULL_STORE_REJECTION",
      status: "COMPLETED",
      reasonCode: "STORE_CLOSED",
      sourceVersion: "phase20-v1",
      operationId: `${marker}-adj-fee-op`,
      requestHash: hash("adj-fee-op"),
      refundAmount: "90.00",
      deliveryFeeAmount: "15.00",
      refundId: multiLineRefund.id,
      completedAt: new Date(),
      allocations: {
        create: [
          {
            marketplaceOrderLineId: orderLine1.id,
            allocationType: "SELLER_BASIS",
            amount: "48.00",
            originalQuantity: 2,
            resolvedQuantityBefore: 0,
            resolvedQuantityAfter: 1,
            sourceAllocationVersion: "phase20-v1",
            roundingSequence: 1,
          },
        ],
      },
    },
  });

  const cursorAfter = `${prefix}_0`;

  // 1) Dry-run (apply: false) inspects both, marks 1 eligible and 1 review-required, mutates nothing
  const dryRun = await recoverPromotionReversals({ limit: 2, after: cursorAfter, apply: false });
  expect(dryRun).toMatchObject({
    examined: 2,
    eligible: 1,
    completed: 0,
    failed: 0,
    review: 1,
    reviewItems: [{ adjustmentId: feeAdjId, refundId: multiLineRefund.id, reasonCode: "DELIVERY_FEE_ADJUSTMENT_REQUIRES_REVIEW" }],
  });
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).reversedAmount.toFixed(2)).toBe("0.00");

  // 2) Live recovery (apply: true) reverses 6.00 platform + 4.00 store = 10.00 total across both lines
  const appliedRun = await recoverPromotionReversals({ limit: 2, after: cursorAfter, apply: true });
  expect(appliedRun).toMatchObject({
    examined: 2,
    eligible: 1,
    completed: 1,
    failed: 0,
    review: 1,
    reviewItems: [{ adjustmentId: feeAdjId, refundId: multiLineRefund.id, reasonCode: "DELIVERY_FEE_ADJUSTMENT_REQUIRES_REVIEW" }],
  });

  const budgetAfter = await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } });
  expect(budgetAfter.committedAmount.toFixed(2)).toBe("15.00");
  expect(budgetAfter.reversedAmount.toFixed(2)).toBe("10.00");

  const redemptionAfter = await prisma.promotionRedemption.findUniqueOrThrow({ where: { id: redemptionId } });
  expect(redemptionAfter.status).toBe("PARTIALLY_REVERSED");

  const movements = await prisma.promotionBudgetMovement.findMany({ where: { redemptionId, movementType: "REVERSE" } });
  expect(movements).toHaveLength(1);
  expect(movements[0].amount.toFixed(2)).toBe("10.00");

  // 3) Replay recovery (apply: true) is idempotent and produces zero new budget movements
  const replayRun = await recoverPromotionReversals({ limit: 2, after: cursorAfter, apply: true });
  expect(replayRun).toMatchObject({
    examined: 2,
    eligible: 1,
    completed: 1,
    failed: 0,
    review: 1,
  });
  expect(await prisma.promotionBudgetMovement.count({ where: { redemptionId, movementType: "REVERSE" } })).toBe(1);
  expect((await prisma.promotionBudget.findUniqueOrThrow({ where: { id: budget.id } })).reversedAmount.toFixed(2)).toBe("10.00");
}, 60_000);

