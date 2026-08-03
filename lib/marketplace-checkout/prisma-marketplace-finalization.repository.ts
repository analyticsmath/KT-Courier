/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 20 Prisma client generation is deferred by instruction. */
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";
import type { MarketplaceFinalizationRepository, MarketplacePaidLine, MarketplacePaidStoreGroup, PaidMarketplaceCheckout } from "@/lib/marketplace-checkout/marketplace-checkout-finalization.service";

const reference = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;
const money = (value: any) => typeof value === "string" ? value : value?.toFixed?.(2) ?? "0.00";

function cents(value: string): bigint { const match = /^(\d+)\.(\d{2})$/.exec(value); if (!match) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Frozen financial evidence is not exact ZAR."); return BigInt(match[1]) * BigInt(100) + BigInt(match[2]); }
function zar(value: bigint): string { return `${value / BigInt(100)}.${(value % BigInt(100)).toString().padStart(2, "0")}`; }
function total(values: readonly string[]): string { return zar(values.reduce((sum, value) => sum + cents(value), BigInt(0))); }
function same(left: string, right: string): boolean { return cents(left) === cents(right); }
function scaled(value: string, quantity: number): string { return zar(cents(value) * BigInt(quantity)); }

function settlement(group: any, evidence: any, commercialFingerprint: string): MarketplacePaidStoreGroup["settlement"] {
  if (!evidence || evidence.checkoutStoreGroupId !== group.id || evidence.commercialFingerprint !== commercialFingerprint || evidence.reviewVersion < 1 || !evidence.sourceEvidenceFingerprint || !evidence.sellerIdentityEvidence || !evidence.commissionEvidence) {
    throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Frozen settlement evidence is required before a paid marketplace checkout can finalize.");
  }
  const sellerBasis = money(evidence.sellerSettlementBasisAmount); const commissionAmount = money(evidence.attributedCommissionAmount); const storeEarningAmount = money(evidence.netStoreEarningAmount); const deliveryFeeResidual = money(group.deliveryFee);
  if (cents(sellerBasis) <= BigInt(0) || cents(commissionAmount) < BigInt(0) || cents(storeEarningAmount) < BigInt(0) || cents(sellerBasis) - cents(commissionAmount) !== cents(storeEarningAmount) || !same(money(evidence.deliveryFeeExcludedAmount), deliveryFeeResidual)) {
    throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "Frozen seller settlement evidence does not reconcile with the accepted checkout.");
  }
  return { commissionPlanReference: evidence.commissionPlanReference, commissionPlanVersion: String(evidence.commissionPlanVersion), sellerBasis, commissionAmount, storeEarningAmount, deliveryFeeResidual, sourceEvidenceFingerprint: evidence.sourceEvidenceFingerprint, sourceSettlementEvidenceId: evidence.id, sourceCheckoutId: evidence.checkoutId, sourceCheckoutReviewVersion: evidence.reviewVersion, sourceCheckoutStoreGroupId: evidence.checkoutStoreGroupId, sourceCommercialFingerprint: evidence.commercialFingerprint };
}

function line(row: any, allocation: any): MarketplacePaidLine {
  const sellerBasis = money(allocation.sellerSettlementBasisAmount); const commission = money(allocation.attributedCommissionAmount); const earning = money(allocation.netStoreEarningAmount);
  if (allocation.checkoutLineSnapshotId !== row.id || !same(scaled(money(row.baseUnitPrice), row.quantity), money(allocation.merchandiseBasisAmount)) || !same(scaled(money(row.modifierUnitTotal), row.quantity), money(allocation.modifierBasisAmount)) || cents(sellerBasis) - cents(commission) !== cents(earning)) {
    throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "Frozen line allocation does not match the accepted checkout line.");
  }
  return {
    checkoutLineSnapshotId: row.id, productReference: row.productReference, variantReference: row.variantReference, offerReference: row.offerReference,
    title: row.productTitle, variantTitle: row.variantTitle, quantity: row.quantity, baseUnitPrice: money(row.baseUnitPrice), modifierUnitTotal: money(row.modifierUnitTotal), effectiveUnitPrice: money(row.effectiveUnitPrice), lineTotal: money(row.lineTotal), taxTreatment: row.taxTreatment, includedTaxAmount: row.includedTaxAmount ? money(row.includedTaxAmount) : null,
    modifiers: row.modifiers.map((item: any) => ({ groupReference: item.groupReference, groupName: item.groupName, optionReference: item.optionReference, optionName: item.optionName, quantity: item.quantity, priceDelta: money(item.priceDelta), totalContribution: money(item.totalContribution), sourceVersion: item.sourceVersion })),
    allocations: [{ type: "SELLER_BASIS", amount: sellerBasis, allocationVersion: allocation.allocationVersion, roundingSequence: allocation.roundingSequence * 3, finalCentRecipient: false }, { type: "COMMISSION", amount: commission, allocationVersion: allocation.allocationVersion, roundingSequence: allocation.roundingSequence * 3 + 1, finalCentRecipient: false }, { type: "STORE_EARNING", amount: earning, allocationVersion: allocation.allocationVersion, roundingSequence: allocation.roundingSequence * 3 + 2, finalCentRecipient: allocation.finalCentRecipient }],
  };
}

export function buildPaidMarketplaceCheckoutFromFrozenEvidence(row: any, evidence: readonly any[], acknowledgement: any): PaidMarketplaceCheckout {
  const commercialFingerprint = row.acceptedFingerprint ?? row.commercialFingerprint ?? "";
  const expectedVersions = evidence.map((item: any) => `${item.publicReference}:${item.evidenceVersion}:${item.sourceEvidenceFingerprint}`).sort();
  const acknowledgedVersions = Array.isArray(acknowledgement?.settlementEvidenceVersions) ? [...acknowledgement.settlementEvidenceVersions].sort() : [];
  if (!commercialFingerprint || acknowledgement?.commercialFingerprint !== commercialFingerprint || JSON.stringify(expectedVersions) !== JSON.stringify(acknowledgedVersions)) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "The accepted checkout does not bind the complete frozen seller settlement evidence.");
  return {
    id: row.id, publicReference: row.publicReference, cartId: row.cartId, status: row.status, currency: row.currency, grandTotal: money(row.grandTotal), commercialFingerprint, customerUserId: row.customerUserId,
    storeGroups: row.storeGroups.map((group: any) => {
      const frozenEvidence = evidence.find((item: any) => item.checkoutStoreGroupId === group.id);
      const frozen = settlement(group, frozenEvidence, commercialFingerprint);
      const allocations = new Map((frozenEvidence?.allocations ?? []).map((item: any) => [item.checkoutLineSnapshotId, item]));
      if (allocations.size !== group.lines.length) throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "Every accepted order line requires frozen settlement allocation evidence.");
      const lines = group.lines.map((item: any) => { const allocation = allocations.get(item.id); if (!allocation) throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "A frozen settlement allocation is missing for an accepted order line."); return line(item, allocation); });
      if (!same(total(lines.map((item: any) => item.allocations[0].amount)), frozen.sellerBasis) || !same(total(lines.map((item: any) => item.allocations[1].amount)), frozen.commissionAmount) || !same(total(lines.map((item: any) => item.allocations[2].amount)), frozen.storeEarningAmount) || !same(total([money(group.merchandiseSubtotal), money(group.modifierSubtotal), money(group.deliveryFee)]), money(group.groupTotal))) throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "Frozen store settlement totals do not reconcile with the accepted checkout.");
      const seller = frozenEvidence.sellerIdentityEvidence as Record<string, unknown>; const policies = frozenEvidence.policyReferences as Record<string, unknown>;
      if (typeof seller.storePublicReference !== "string" || typeof seller.legalName !== "string") throw new MarketplaceCheckoutError("SELLER_IDENTITY_INCOMPLETE", "Frozen seller identity evidence is incomplete.");
      return { checkoutStoreGroupId: group.id, storeId: group.storeId, storeReference: seller.storePublicReference, merchandiseSubtotal: money(group.merchandiseSubtotal), modifierSubtotal: money(group.modifierSubtotal), deliveryFee: money(group.deliveryFee), groupTotal: money(group.groupTotal), sellerIdentityEvidence: seller, taxEvidence: frozenEvidence.taxEvidence, termsReference: typeof policies.termsReference === "string" ? policies.termsReference : null, refundPolicyReference: null, lines, settlement: frozen };
    }),
  };
}

/** Real Serializable Prisma adapter used only through the Phase 20 finalizer. */
export function createPrismaMarketplaceFinalizationRepository(database: any = prisma): MarketplaceFinalizationRepository {
  let db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => { const previous = db; db = tx; try { return await work(); } finally { db = previous; } }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    lockVerifiedSuccessfulPayment: async (paymentId: string) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "Payment" WHERE "id" = ${paymentId} FOR UPDATE`);
      const payment = await db.payment.findUnique({ where: { id: paymentId } });
      return payment ? { id: payment.id, publicReference: payment.publicReference, status: payment.status, amount: money(payment.amount), currency: payment.currency, marketplaceCheckoutId: payment.marketplaceCheckoutId } : null;
    },
    lockCheckout: async (checkoutId: string) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "id" = ${checkoutId} FOR UPDATE`);
      const row = await db.marketplaceCheckout.findUnique({ where: { id: checkoutId }, include: { storeGroups: { include: { lines: { include: { modifiers: true } } } } } });
      if (!row) return null;
      const currentLines = await db.marketplaceCheckoutLineSnapshot.findMany({ where: { checkoutId, reviewVersion: row.reviewVersion }, include: { modifiers: true } });
      for (const group of row.storeGroups) group.lines = currentLines.filter((item: any) => item.storeGroupId === group.id);
      const evidence = await db.marketplaceCheckoutStoreSettlementEvidence.findMany({ where: { checkoutId, reviewVersion: row.reviewVersion }, include: { allocations: true }, orderBy: { checkoutStoreGroupId: "asc" } });
      const acknowledgement = await db.marketplaceCheckoutAcknowledgement.findUnique({ where: { checkoutId_reviewVersion: { checkoutId, reviewVersion: row.reviewVersion } } });
      if (evidence.length !== row.storeGroups.length) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Every accepted store group requires frozen settlement evidence.");
      return buildPaidMarketplaceCheckoutFromFrozenEvidence(row, evidence, acknowledgement);
    },
    lockReservation: async (checkoutId: string) => {
      const row = await db.marketplaceInventoryReservation.findFirst({ where: { checkoutId, status: { in: ["ACTIVE", "PAYMENT_PENDING_HOLD"] } }, include: { items: true }, orderBy: { createdAt: "asc" } });
      if (row) await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceInventoryReservation" WHERE "id" = ${row.id} FOR UPDATE`);
      return row ? { id: row.id, status: row.status, commercialFingerprint: row.commercialFingerprint } : null;
    },
    findOrderByCheckout: async (checkoutId: string) => db.marketplaceOrder.findUnique({ where: { checkoutId }, select: { publicReference: true } }),
    consumeReservation: async (reservationId: string, paymentId: string, operationId: string) => {
      const reservation = await db.marketplaceInventoryReservation.findUnique({ where: { id: reservationId }, include: { items: { include: { inventoryLevel: true } } } });
      if (!reservation) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reservation disappeared before finalization.");
      const ordered = [...reservation.items].sort((a: any, b: any) => a.inventoryLevelId.localeCompare(b.inventoryLevelId));
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "CatalogInventoryLevel" WHERE "id" IN (${Prisma.join(ordered.map((item: any) => item.inventoryLevelId))}) ORDER BY "id" ASC FOR UPDATE`);
      for (const item of ordered) {
        const level = await db.catalogInventoryLevel.findUnique({ where: { id: item.inventoryLevelId }, include: { inventoryItem: { include: { offer: { include: { store: true } } } }, location: true } });
        if (!level || level.reserved < item.quantity || level.onHand < item.quantity || level.available < 0) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Reserved inventory no longer has a valid locked projection.");
        const actorUserId = level.inventoryItem.offer.store.ownerUserId;
        if (!actorUserId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The locked inventory item is missing canonical store ownership evidence.");
        await db.catalogInventoryLevel.update({ where: { id: level.id }, data: { onHand: { decrement: item.quantity }, reserved: { decrement: item.quantity }, version: { increment: 1 } } });
        await db.catalogInventoryMovement.create({ data: { publicReference: reference("CIM"), inventoryItemId: level.inventoryItemId, locationId: level.locationId, type: "SALE_COMMITMENT", quantityDelta: -item.quantity, operationId: `${operationId}:${level.id}`, requestHash: operationId, reasonCode: "MARKETPLACE_ORDER_COMMITMENT", actorUserId, resultingOnHand: level.onHand - item.quantity } });
      }
      await db.marketplaceInventoryReservation.update({ where: { id: reservationId }, data: { status: "CONSUMED", paymentId, consumedAt: new Date() } });
    },
    createMarketplaceOrder: async ({ checkout: paid, paymentId, paymentReference, guestConfirmationHash }) => {
      void paymentReference;
      const created = await db.marketplaceOrder.create({ data: { publicReference: reference("morder"), checkoutId: paid.id, paymentId, customerUserId: paid.customerUserId, guestConfirmationHash, currency: "ZAR", merchandiseSubtotal: total(paid.storeGroups.map((group) => group.merchandiseSubtotal)), modifierSubtotal: total(paid.storeGroups.map((group) => group.modifierSubtotal)), deliveryFeeTotal: total(paid.storeGroups.map((group) => group.deliveryFee)), grandTotal: paid.grandTotal, commercialFingerprint: paid.commercialFingerprint, status: "CONFIRMED" } });
      await db.payment.update({ where: { id: paymentId }, data: { marketplaceOrderId: created.id } });
      return { id: created.id, publicReference: created.publicReference };
    },
    createMarketplaceStoreOrder: async ({ marketplaceOrderId, group }) => {
      if (!group.checkoutStoreGroupId) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Finalization is missing the immutable checkout store-group identity.");
      const created = await db.marketplaceStoreOrder.create({ data: { publicReference: reference("msorder"), marketplaceOrderId, checkoutStoreGroupId: group.checkoutStoreGroupId, storeId: group.storeId, status: "PENDING_SETTLEMENT", currency: "ZAR", merchandiseSubtotal: group.merchandiseSubtotal, modifierSubtotal: group.modifierSubtotal, deliveryFee: group.deliveryFee, groupTotal: group.groupTotal, sellerIdentityEvidence: group.sellerIdentityEvidence, taxEvidence: group.taxEvidence, termsReference: group.termsReference, refundPolicyReference: group.refundPolicyReference } });
      return { id: created.id, publicReference: created.publicReference };
    },
    createOrderLineEvidence: async ({ marketplaceStoreOrderId, line: evidence }) => {
      const created = await db.marketplaceOrderLine.create({ data: { marketplaceStoreOrderId, checkoutLineSnapshotId: evidence.checkoutLineSnapshotId, productReference: evidence.productReference, variantReference: evidence.variantReference, offerReference: evidence.offerReference, title: evidence.title, variantTitle: evidence.variantTitle, quantity: evidence.quantity, baseUnitPrice: evidence.baseUnitPrice, modifierUnitTotal: evidence.modifierUnitTotal, effectiveUnitPrice: evidence.effectiveUnitPrice, lineTotal: evidence.lineTotal, taxTreatment: evidence.taxTreatment, includedTaxAmount: evidence.includedTaxAmount, modifiers: { create: evidence.modifiers }, financialAllocations: { create: evidence.allocations } } });
      // Phase 21's record starts with immutable origin quantity. It is created
      // with the paid line, never reconstructed from mutable catalog data.
      await db.marketplaceStoreOrderLineFulfilment.create({ data: { publicReference: reference("soline"), marketplaceStoreOrderId, marketplaceOrderLineId: created.id, orderedQuantity: evidence.quantity, confirmedAvailableQuantity: 0, resolvedFulfilmentQuantity: 0, handedOffQuantity: 0, status: "ORDERED", substitutionPreference: "REFUND_IF_UNAVAILABLE" } });
    },
    createSettlementSnapshot: async ({ marketplaceStoreOrderId, paymentId, group }) => { await db.marketplaceSettlementSnapshot.create({ data: { publicReference: reference("msettle"), marketplaceStoreOrderId, sourceCheckoutId: group.settlement.sourceCheckoutId, sourceCheckoutReviewVersion: group.settlement.sourceCheckoutReviewVersion, sourceCheckoutStoreGroupId: group.settlement.sourceCheckoutStoreGroupId, sourceSettlementEvidenceId: group.settlement.sourceSettlementEvidenceId, sourceCommercialFingerprint: group.settlement.sourceCommercialFingerprint, sourcePaymentId: paymentId, settlementVersion: "phase20-v1", commissionPlanReference: group.settlement.commissionPlanReference, commissionPlanVersion: group.settlement.commissionPlanVersion, sellerBasis: group.settlement.sellerBasis, commissionAmount: group.settlement.commissionAmount, storeEarningAmount: group.settlement.storeEarningAmount, deliveryFeeResidual: group.settlement.deliveryFeeResidual, sourceEvidenceFingerprint: group.settlement.sourceEvidenceFingerprint, currency: "ZAR", status: "PENDING" } }); },
    scheduleSettlement: async ({ marketplaceStoreOrderId, group, operationId }) => {
      const snapshot = await db.marketplaceSettlementSnapshot.findFirst({ where: { marketplaceStoreOrderId, settlementVersion: "phase20-v1" }, select: { id: true, sourceEvidenceFingerprint: true } });
      if (!snapshot) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Settlement work cannot be scheduled without the immutable settlement snapshot.");
      const requestHash = createHash("sha256").update(`${marketplaceStoreOrderId}:${snapshot.sourceEvidenceFingerprint}:phase20-v1`).digest("hex");
      await db.marketplaceStoreSettlementJob.create({ data: { publicReference: reference("msettlejob"), marketplaceStoreOrderId, settlementSnapshotId: snapshot.id, settlementVersion: "phase20-v1", operationId, requestHash, status: "PENDING" } });
      void group;
    },
    completeCheckoutAndConvertCart: async (checkoutId: string, cartId: string) => { await db.marketplaceCheckout.update({ where: { id: checkoutId }, data: { status: "COMPLETED", completedAt: new Date() } }); await db.marketplaceCart.update({ where: { id: cartId }, data: { status: "CONVERTED", convertedCheckoutId: checkoutId, version: { increment: 1 } } }); },
  });
}
