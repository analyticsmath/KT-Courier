/* eslint-disable @typescript-eslint/no-explicit-any -- generated client update is intentionally deferred. */
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import type { CartOwner } from "@/lib/marketplace-checkout/cart.service";
import type { MarketplaceAcknowledgementRepository, MarketplaceCheckoutReviewRepository } from "@/lib/marketplace-checkout/checkout-review-persistence.service";
import type { MarketplaceCheckoutReviewResult, ReviewGroup } from "@/lib/marketplace-checkout/checkout-review.service";
import { freezeMarketplaceStoreSettlementEvidence } from "@/lib/marketplace-checkout/frozen-seller-settlement-evidence.service";
import { MarketplaceCheckoutError } from "@/lib/marketplace-checkout/errors";

const money = (value: any) => typeof value === "string" ? value : value?.toFixed?.(2) ?? "0.00";
const ownerWhere = (owner: CartOwner) => owner.type === "CUSTOMER" ? { customerUserId: owner.userId } : { guestAccessTokenHash: owner.guestTokenHash };
const exact = (left: string, right: string) => new Prisma.Decimal(left).add(new Prisma.Decimal(right)).toFixed(2);
const evidenceFingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

function checkoutInclude(reviewVersion?: number) {
  return {
    addressSnapshot: { select: { serviceAreaReference: true } },
    storeGroups: {
      include: {
        lines: { where: reviewVersion ? { reviewVersion } : undefined, include: { modifiers: true } },
      },
      orderBy: { storeId: "asc" },
    },
    changes: reviewVersion ? { where: { reviewVersion }, orderBy: { createdAt: "asc" } } : undefined,
    settlementEvidence: { select: { publicReference: true, reviewVersion: true, evidenceVersion: true, sourceEvidenceFingerprint: true, checkoutStoreGroupId: true } },
  };
}

function toReviewable(row: any): any {
  return {
    ...row,
    grandTotal: money(row.grandTotal),
    addressServiceAreaReference: row.addressSnapshot?.serviceAreaReference ?? null,
    groups: row.storeGroups.map((group: any): ReviewGroup => ({
      storeReference: group.storeId,
      pickupLocationReference: group.pickupLocationReference,
      fulfilmentMode: group.fulfilmentMode,
      lines: group.lines.map((line: any) => ({
        lineReference: line.id,
        storeReference: group.storeId,
        offerReference: line.offerReference,
        variantReference: line.variantReference,
        productReference: line.productReference,
        productTitle: line.productTitle,
        variantTitle: line.variantTitle,
        sellingUnit: line.sellingUnit,
        quantity: line.quantity,
        priceVersion: line.priceVersion,
        publicationVersion: line.publicationVersion,
        baseUnitPrice: money(line.baseUnitPrice),
        modifierUnitTotal: money(line.modifierUnitTotal),
        lineTotal: money(line.lineTotal),
        taxTreatment: line.taxTreatment,
        includedTaxAmount: line.includedTaxAmount ? money(line.includedTaxAmount) : null,
        inventoryItemId: line.inventoryItemId,
        inventoryLocationId: line.inventoryLocationId,
        modifiers: line.modifiers.map((modifier: any) => ({ ...modifier, priceDelta: money(modifier.priceDelta), totalContribution: money(modifier.totalContribution) })),
      })),
    })),
    sourceGroups: row.storeGroups.map((group: any) => ({ id: group.id, storeId: group.storeId })),
    settlementEvidenceVersions: row.settlementEvidence.filter((item: any) => item.reviewVersion === row.reviewVersion).sort((left: any, right: any) => left.checkoutStoreGroupId.localeCompare(right.checkoutStoreGroupId)).map((item: any) => `${item.publicReference}:${item.evidenceVersion}:${item.sourceEvidenceFingerprint}`),
  };
}

function publicReview(result: MarketplaceCheckoutReviewResult) {
  const safe: any = { ...result };
  delete safe.revalidatedGroups;
  return safe;
}

export function createPrismaMarketplaceReviewRepository(database: any = prisma): MarketplaceCheckoutReviewRepository {
  let db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => {
      const previous = db; db = tx;
      try { return await work(); } finally { db = previous; }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    lockCheckout: async (reference: string, owner: CartOwner) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "publicReference" = ${reference} FOR UPDATE`);
      const row = await db.marketplaceCheckout.findFirst({ where: { publicReference: reference, ...ownerWhere(owner) }, include: checkoutInclude() });
      return row ? toReviewable(row) : null;
    },
    findOperation: async (checkoutId: string, operationId: string) => {
      const row = await db.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId, operationId } } });
      return row ? { requestHash: row.requestHash, response: row.response as MarketplaceCheckoutReviewResult } : null;
    },
    freezeSettlementEvidence: async ({ checkout, result }) => {
      if (result.revalidatedGroups.length !== checkout.sourceGroups.length) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Every checkout store must produce complete reviewed settlement evidence.");
      const authoritativeAt = new Date();
      const authority = await Promise.all(result.revalidatedGroups.map(async (group) => {
        const stored = checkout.sourceGroups.find((item) => item.storeId === group.storeReference);
        if (!stored) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "A reviewed store group no longer has canonical identity.");
        const store = await db.store.findUnique({ where: { id: stored.storeId }, select: { id: true, slug: true, status: true } });
        if (!store || store.status !== "ACTIVE") throw new MarketplaceCheckoutError("SELLER_IDENTITY_INCOMPLETE", "The reviewed store is not an active seller authority.");
        const identity = await db.storeSellerLegalIdentity.findFirst({ where: { storeId: store.id, status: "APPROVED", effectiveFrom: { lte: authoritativeAt }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: authoritativeAt } }] }, orderBy: [{ effectiveFrom: "desc" }, { id: "asc" }] });
        if (!identity) throw new MarketplaceCheckoutError("SELLER_IDENTITY_INCOMPLETE", "The reviewed store has no approved legal seller identity.");
        // Phase 22 may constrain a store to a pre-approved Phase 14 plan. It
        // returns only that plan identity; Phase 20 still freezes the actual
        // Phase 14 rules and never calculates a commission itself.
        const entitlement = await db.subscriptionEntitlementGrant.findFirst({ where: { storeId: store.id, status: "ACTIVE", effectiveFrom: { lte: authoritativeAt }, effectiveUntil: { gt: authoritativeAt }, billingCycle: { status: "PAID" }, contract: { status: { in: ["ACTIVE", "CANCELLATION_SCHEDULED"] } }, benefitDefinition: { benefitType: "APPROVED_COMMISSION_PLAN_ELIGIBILITY", permittedConsumingPhase: "CHECKOUT_REVIEW" } }, include: { benefitDefinition: true, billingCycle: true, contract: true }, orderBy: { effectiveUntil: "asc" } });
        const entitlementPolicy = entitlement?.benefitDefinition.eligibilityConditions as Record<string, unknown> | null;
        const eligiblePlanReference = typeof entitlementPolicy?.approvedCommissionPlanReference === "string" ? entitlementPolicy.approvedCommissionPlanReference : null;
        const eligiblePlanVersion = typeof entitlementPolicy?.approvedCommissionPlanVersion === "number" ? entitlementPolicy.approvedCommissionPlanVersion : null;
        const plan = await db.commissionPlan.findFirst({ where: { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}`, currency: "ZAR", status: "ACTIVE", approvedAt: { not: null }, effectiveFrom: { lte: authoritativeAt }, OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: authoritativeAt } }], ...(entitlement ? { publicReference: eligiblePlanReference ?? "__SUBSCRIPTION_ENTITLEMENT_PLAN_MISSING__", ...(eligiblePlanVersion !== null ? { versionNumber: eligiblePlanVersion } : {}) } : {}) }, include: { rules: { orderBy: { priority: "asc" } } }, orderBy: [{ versionNumber: "desc" }, { id: "asc" }] });
        if (!plan) {
          const exists = await db.commissionPlan.findFirst({ where: { subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: `STORE:${store.id}`, currency: "ZAR" }, select: { id: true } });
          throw new MarketplaceCheckoutError(exists ? "COMMISSION_PLAN_NOT_APPROVED" : "COMMISSION_PLAN_MISSING", "The reviewed store has no approved applicable commission plan.");
        }
        return { group, stored, store, identity, plan };
      }));
      const commercialFingerprint = evidenceFingerprint({ reviewedFingerprint: result.commercialFingerprint, reviewVersion: result.reviewVersion, authorities: authority.map(({ stored, identity, plan }) => ({ group: stored.id, identityReference: identity.publicReference, identityVersion: identity.identityVersion, planReference: plan.publicReference, planVersion: plan.versionNumber, calculationVersion: plan.calculationVersion })) });
      const evidence = authority.map(({ group, stored, store, identity, plan }) => {
        const quote = result.quotes.find((item) => item.storeReference === group.storeReference);
        if (!quote) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "The reviewed store lacks delivery quote evidence.");

        let storeFundedPromotionAmount = "0.00";
        if (result.promotionEvidence && typeof result.promotionEvidence === "object" && "allocations" in result.promotionEvidence) {
          const allocs = (result.promotionEvidence as any).allocations;
          if (Array.isArray(allocs)) {
            let sum = 0;
            for (const a of allocs) {
              if (a.storeReference === group.storeReference) {
                sum += Number(a.storeFunding || 0);
              }
            }
            storeFundedPromotionAmount = sum.toFixed(2);
          }
        }

        return freezeMarketplaceStoreSettlementEvidence({ checkoutReference: checkout.publicReference, reviewVersion: result.reviewVersion, commercialFingerprint, checkoutStoreGroupReference: stored.id, storeId: store.id, storeReference: store.slug, deliveryFee: quote.deliveryFee, sellerIdentity: { publicReference: identity.publicReference, identityVersion: identity.identityVersion, legalName: identity.legalName, tradingName: identity.tradingName, registrationReference: identity.registrationReference, vatRegistrationStatus: identity.vatRegistrationStatus, vatNumber: identity.vatNumber, countryCode: identity.countryCode, termsReference: identity.termsReference, invoiceClassification: identity.invoiceClassification }, commissionPlan: { publicReference: plan.publicReference, versionNumber: plan.versionNumber, calculationVersion: plan.calculationVersion, basisType: plan.basisType, subjectType: "MARKETPLACE_STORE_ORDER", scopeKey: plan.scopeKey, rules: plan.rules }, lines: group.lines, authoritativeAt: authoritativeAt.toISOString(), storeFundedPromotionAmount, frozenPromotionEvidence: result.promotionEvidence });
      });
      return Object.freeze({ commercialFingerprint, evidence: Object.freeze(evidence) });
    },
    persistReview: async ({ checkout, result, settlementEvidence, operationId, requestHash }) => {
      if (settlementEvidence.length !== result.revalidatedGroups.length) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "Every reviewed store group requires frozen settlement evidence.");
      for (const group of result.revalidatedGroups) {
        const stored = checkout.sourceGroups.find((item) => item.storeId === group.storeReference);
        const quote = result.quotes.find((item) => item.storeReference === group.storeReference);
        const evidence = stored ? settlementEvidence.find((item) => item.checkoutStoreGroupReference === stored.id) : null;
        if (!stored || !evidence || evidence.lineAllocations.length !== group.lines.length) throw new MarketplaceCheckoutError("SELLER_SETTLEMENT_EVIDENCE_INCOMPLETE", "The reviewed store group lacks complete frozen seller settlement evidence.");
        const groupMerchandise = group.lines.reduce((total, line) => exact(total, new Prisma.Decimal(line.baseUnitPrice).mul(line.quantity).toFixed(2)), "0.00");
        const groupModifiers = group.lines.reduce((total, line) => exact(total, new Prisma.Decimal(line.modifierUnitTotal).mul(line.quantity).toFixed(2)), "0.00");
        const deliveryFee = quote?.deliveryFee ?? "0.00";
        await db.marketplaceCheckoutStoreGroup.update({ where: { id: stored.id }, data: {
          merchandiseSubtotal: groupMerchandise, modifierSubtotal: groupModifiers, deliveryFee,
          groupTotal: exact(exact(groupMerchandise, groupModifiers), deliveryFee),
          deliveryQuoteReference: quote?.quoteReference ?? null, deliveryQuoteVersion: quote?.quoteVersion ?? null, deliveryQuoteExpiresAt: quote?.quoteExpiresAt ?? null,
          serviceabilityReference: quote?.serviceabilityReference ?? null,
          status: quote ? "READY" : "NOT_SERVICEABLE",
        } });
        const createdLines = new Map<string, any>();
        for (const line of group.lines) {
          const created = await db.marketplaceCheckoutLineSnapshot.create({ data: {
            checkoutId: checkout.id, storeGroupId: stored.id, reviewVersion: result.reviewVersion,
            productReference: line.productReference ?? line.offerReference, variantReference: line.variantReference, offerReference: line.offerReference,
            storeReference: group.storeReference, productTitle: line.productTitle ?? line.productReference ?? line.offerReference, variantTitle: line.variantTitle ?? line.variantReference,
            quantity: line.quantity, sellingUnit: line.sellingUnit ?? "EACH", publicationVersion: line.publicationVersion, priceVersion: line.priceVersion,
            baseUnitPrice: line.baseUnitPrice, modifierUnitTotal: line.modifierUnitTotal,
            effectiveUnitPrice: exact(line.baseUnitPrice, line.modifierUnitTotal), lineTotal: line.lineTotal,
            currency: "ZAR", inventoryItemId: line.inventoryItemId ?? null, inventoryLocationId: line.inventoryLocationId ?? null,
            taxTreatment: line.taxTreatment ?? "SOURCE_PRICE_INCLUDES_TAX", includedTaxAmount: line.includedTaxAmount ?? null,
            modifiers: { create: (line.modifiers ?? []).map((modifier) => ({ ...modifier })) },
          } });
          createdLines.set(line.lineReference, created);
        }
        const persistedEvidence = await db.marketplaceCheckoutStoreSettlementEvidence.create({ data: {
          publicReference: `MCSE_${evidence.sourceEvidenceFingerprint.slice(0, 24)}`,
          checkoutId: checkout.id, checkoutStoreGroupId: stored.id, reviewVersion: evidence.checkoutReviewVersion,
          commercialFingerprint: evidence.commercialFingerprint, evidenceVersion: evidence.evidenceVersion,
          sellerIdentityReference: evidence.sellerIdentity.identityReference, sellerIdentityVersion: evidence.sellerIdentity.identityVersion,
          sellerIdentityEvidence: evidence.sellerIdentity, commissionPlanReference: evidence.commission.planReference,
          commissionPlanVersion: evidence.commission.planVersion, commissionCalculationVersion: evidence.commission.calculationVersion,
          commissionEvidence: evidence.commission, sellerSettlementBasisAmount: evidence.sellerSettlementBasisAmount,
          attributedCommissionAmount: evidence.attributedCommissionAmount, netStoreEarningAmount: evidence.netStoreEarningAmount,
          deliveryFeeExcludedAmount: evidence.deliveryFeeExcludedAmount, taxEvidence: evidence.taxEvidence,
          policyReferences: evidence.policyReferences, sourceEvidenceFingerprint: evidence.sourceEvidenceFingerprint,
        } });
        for (const allocation of evidence.lineAllocations) {
          const snapshot = createdLines.get(allocation.sourceLineReference);
          if (!snapshot) throw new MarketplaceCheckoutError("SETTLEMENT_ALLOCATION_MISMATCH", "Frozen settlement allocation does not map to a reviewed line.");
          await db.marketplaceCheckoutSettlementLineAllocation.create({ data: {
            settlementEvidenceId: persistedEvidence.id, checkoutLineSnapshotId: snapshot.id,
            stableOrderingKey: allocation.stableOrderingKey, merchandiseBasisAmount: allocation.merchandiseBasisAmount,
            modifierBasisAmount: allocation.modifierBasisAmount, sellerSettlementBasisAmount: allocation.sellerSettlementBasisAmount,
            attributedCommissionAmount: allocation.attributedCommissionAmount, netStoreEarningAmount: allocation.netStoreEarningAmount,
            taxEvidence: allocation.taxEvidence, allocationVersion: allocation.allocationVersion,
            roundingSequence: allocation.roundingSequence, finalCentRecipient: allocation.finalCentRecipient,
          } });
        }
      }
      if (result.changes.length) await db.marketplaceCheckoutChange.createMany({ data: result.changes.map((change) => ({ checkoutId: checkout.id, reviewVersion: result.reviewVersion, type: change.type, lineReference: change.lineReference ?? null, details: change.details })) });
      await db.marketplaceCheckout.update({ where: { id: checkout.id }, data: {
        status: result.status, reviewVersion: result.reviewVersion, merchandiseSubtotal: result.merchandiseSubtotal, modifierSubtotal: result.modifierSubtotal,
        deliveryFeeTotal: result.deliveryFeeTotal, grandTotal: result.grandTotal, commercialFingerprint: result.commercialFingerprint,
        acceptedFingerprint: null, changesAcknowledgedAt: null, reviewAcceptedAt: null, termsAcknowledgedAt: null, version: { increment: 1 },
      } });
      await db.marketplaceCheckoutOperation.create({ data: { checkoutId: checkout.id, operationId, requestHash, type: "REVIEW", response: publicReview(result) } });
    },
  });
}

export function createPrismaMarketplaceAcknowledgementRepository(database: any = prisma): MarketplaceAcknowledgementRepository {
  let db = database;
  return Object.freeze({
    transaction: async <T>(work: () => Promise<T>) => database.$transaction(async (tx: any) => { const previous = db; db = tx; try { return await work(); } finally { db = previous; } }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    lockCheckout: async (reference: string, owner: CartOwner) => {
      await db.$queryRaw(Prisma.sql`SELECT "id" FROM "MarketplaceCheckout" WHERE "publicReference" = ${reference} FOR UPDATE`);
      const row = await db.marketplaceCheckout.findFirst({ where: { publicReference: reference, ...ownerWhere(owner) }, include: checkoutInclude() });
      if (!row) return null;
      const currentChanges = await db.marketplaceCheckoutChange.findMany({ where: { checkoutId: row.id, reviewVersion: row.reviewVersion }, orderBy: { createdAt: "asc" } });
      return { ...toReviewable(row), changes: currentChanges };
    },
    findOperation: async (checkoutId: string, operationId: string) => {
      const row = await db.marketplaceCheckoutOperation.findUnique({ where: { checkoutId_operationId: { checkoutId, operationId } } });
      return row ? { requestHash: row.requestHash, response: row.response as { acknowledged: true; reviewVersion: number } } : null;
    },
    createAcknowledgement: async (input) => {
      const response = { acknowledged: true as const, reviewVersion: input.reviewVersion };
      await db.marketplaceCheckoutAcknowledgement.create({ data: { checkoutId: input.checkoutId, reviewVersion: input.reviewVersion, commercialFingerprint: input.commercialFingerprint, grandTotal: input.acknowledgedTotalReference, termsVersion: input.termsVersion, privacyVersion: input.privacyVersion, refundPolicyReferences: input.refundPolicyReferences, settlementEvidenceVersions: input.settlementEvidenceVersions, changeSet: input.changes } });
      await db.marketplaceCheckoutChange.updateMany({ where: { checkoutId: input.checkoutId, reviewVersion: input.reviewVersion, acknowledgedAt: null }, data: { acknowledgedAt: new Date() } });
      await db.marketplaceCheckout.update({ where: { id: input.checkoutId }, data: { status: "READY_FOR_REVIEW", acceptedFingerprint: input.commercialFingerprint, changesAcknowledgedAt: new Date(), termsAcknowledgedAt: new Date(), reviewAcceptedAt: new Date(), version: { increment: 1 } } });
      await db.marketplaceCheckoutOperation.create({ data: { checkoutId: input.checkoutId, operationId: input.operationId, requestHash: input.requestHash, type: "ACKNOWLEDGE", response } });
    },
  });
}
