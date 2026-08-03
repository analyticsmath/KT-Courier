/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma generation is intentionally deferred to Phase 26.5. */
import { prisma } from "@/lib/db/prisma";
import type { SubscriptionContractRepository } from "@/lib/subscriptions/subscription-contract.service";
import type { SubscriptionReviewRepository } from "@/lib/subscriptions/subscription-review.service";
import type { SubscriptionSubjectType } from "@/lib/subscriptions/contract-policy";

const db = prisma as any;

async function authorisedStorePayer(storeId: string, payerUserId: string): Promise<boolean> {
  const [store, override, authority] = await Promise.all([
    db.store.findUnique({ where: { id: storeId }, select: { ownerUserId: true } }),
    db.userPermission.findFirst({ where: { userId: payerUserId, permission: { key: "store_subscriptions.billing" } }, select: { effect: true } }),
    db.subscriptionStoreBillingAuthority.findFirst({ where: { storeId, userId: payerUserId, status: "ACTIVE" }, select: { id: true } }),
  ]);
  if (!store) return false;
  if (override?.effect === "DENY") return false;
  if (store.ownerUserId === payerUserId) return true;
  return Boolean(authority && (override?.effect === "ALLOW" || authority.id));
}

function mapPlan(row: any) {
  return {
    id: row.id, publicReference: row.publicReference, programId: row.programId, subjectType: row.program.subjectType, status: row.status,
    displayName: row.displayName, shortDescription: row.shortDescription, fullDescription: row.fullDescription, contractTermType: row.contractTermType,
    billingInterval: row.billingInterval, billingIntervalCount: row.billingIntervalCount, priceAmount: row.priceAmount.toFixed(2), currency: row.currency,
    taxTreatment: row.taxTreatment, includedTaxAmount: row.includedTaxAmount?.toFixed(2) ?? null, cancellationPolicyVersion: row.cancellationPolicyVersion,
    renewalPolicyVersion: row.renewalPolicyVersion, dunningPolicyVersion: row.dunningPolicyVersion, entitlementPolicyVersion: row.entitlementPolicyVersion,
    legalDocumentVersion: row.legalDocumentVersion, effectiveFrom: row.effectiveFrom, effectiveUntil: row.effectiveUntil,
    benefits: row.benefits.map((benefit: any) => ({ publicReference: benefit.publicReference, benefitType: benefit.benefitType, valueType: benefit.valueType, amount: benefit.amount?.toFixed(2) ?? null, quantity: benefit.quantity, usageCap: benefit.usageCap, period: benefit.period, permittedConsumingPhase: benefit.permittedConsumingPhase, stackingPolicy: benefit.stackingPolicy, reversalPolicy: benefit.reversalPolicy, sourceVersion: benefit.sourceVersion })),
  } as const;
}

export function createPrismaSubscriptionReviewRepository(database: any = db): SubscriptionReviewRepository {
  return Object.freeze({
    async resolveActivePlan({ planReference, subjectType, at }) {
      const plan = await database.subscriptionPlanVersion.findFirst({ where: { publicReference: planReference, status: "ACTIVE", program: { subjectType, status: "ACTIVE" }, OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: at } }], AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: at } }] }] }, include: { program: true, benefits: { orderBy: { publicReference: "asc" } } } });
      return plan ? mapPlan(plan) : null;
    },
    async hasNonTerminalContract({ programId, customerUserId, storeId }) {
      return Boolean(await database.subscriptionContract.findFirst({ where: { programId, customerUserId, storeId, status: { notIn: ["CANCELLED", "EXPIRED"] } }, select: { id: true } }));
    },
    storePayerAuthorised: ({ storeId, payerUserId }) => authorisedStorePayer(storeId, payerUserId),
    async createReview(input) {
      await database.subscriptionReview.create({ data: input });
    },
  });
}

export function createPrismaSubscriptionContractRepository(database: any = db): SubscriptionContractRepository {
  return Object.freeze({
    async getReview(reference, payerUserId) {
      const review = await database.subscriptionReview.findFirst({ where: { publicReference: reference, payerUserId }, select: { id: true, publicReference: true, programId: true, planVersionId: true, subjectType: true, customerUserId: true, storeId: true, payerUserId: true, reviewVersion: true, commercialFingerprint: true, status: true, reviewSnapshot: true, expiresAt: true } });
      if (!review) return null;
      return { ...review, snapshot: review.reviewSnapshot };
    },
    storePayerAuthorised: ({ storeId, payerUserId }) => authorisedStorePayer(storeId, payerUserId),
    async hasNonTerminalContract({ programId, customerUserId, storeId }) {
      return Boolean(await database.subscriptionContract.findFirst({ where: { programId, customerUserId, storeId, status: { notIn: ["CANCELLED", "EXPIRED"] } }, select: { id: true } }));
    },
    async createAcknowledgement(input) {
      await database.$transaction(async (tx: any) => {
        const review = await tx.subscriptionReview.findUnique({ where: { id: input.reviewId } });
        if (!review || review.status !== "CURRENT" || review.reviewVersion !== input.reviewVersion || review.commercialFingerprint !== input.commercialFingerprint || review.expiresAt <= new Date()) throw new Error("STALE_REVIEW");
        await tx.subscriptionAcknowledgement.create({ data: input });
        await tx.subscriptionReview.update({ where: { id: input.reviewId }, data: { status: "ACKNOWLEDGED" } });
      });
    },
    async prepareInitialAggregate(input) {
      return database.$transaction(async (tx: any) => {
        const prior = await tx.payment.findUnique({ where: { creationIdempotencyKey: input.operationId }, include: { subscriptionInvoice: { include: { contract: true } } } });
        if (prior) {
          if (prior.creationRequestHash !== input.requestHash || !prior.subscriptionInvoice) throw new Error("SUBSCRIPTION_IDEMPOTENCY_CONFLICT");
          const authority = await tx.subscriptionPaymentAuthority.findUnique({ where: { contractId: prior.subscriptionInvoice.contractId }, select: { publicReference: true } });
          if (!authority) throw new Error("SUBSCRIPTION_AUTHORITY_MISSING");
          return { contractReference: prior.subscriptionInvoice.contract.publicReference, authorityReference: authority.publicReference, invoiceReference: prior.subscriptionInvoice.publicReference, paymentReference: prior.publicReference, replayed: true };
        }
        const contract = await tx.subscriptionContract.create({ data: input.contract });
        const acknowledgement = await tx.subscriptionAcknowledgement.create({ data: { ...input.acknowledgement, contractId: contract.id } });
        const authority = await tx.subscriptionPaymentAuthority.create({ data: { ...input.authority, contractId: contract.id } });
        const cycle = await tx.subscriptionBillingCycle.create({ data: { ...input.billingCycle, contractId: contract.id } });
        const invoice = await tx.subscriptionInvoice.create({ data: { ...input.invoice, contractId: contract.id, billingCycleId: cycle.id, payerUserId: contract.payerUserId } });
        const payment = await tx.payment.create({ data: { publicReference: input.payment.publicReference, userId: contract.payerUserId, orderId: null, marketplaceCheckoutId: null, marketplaceOrderId: null, subscriptionInvoiceId: invoice.id, subjectType: "SUBSCRIPTION_INVOICE", provider: null, purpose: "ORDER", status: "CREATED", amount: input.payment.amount, currency: "ZAR", creationIdempotencyKey: input.operationId, creationRequestHash: input.requestHash, version: 0, latestAttemptNumber: 0, metadata: { subjectType: "SUBSCRIPTION_INVOICE", invoiceReference: invoice.publicReference } } });
        // Phase 12 resolves recurring ITNs through the normal immutable
        // PaymentAttempt boundary. The recurring merchant reference remains
        // the exact subscription invoice, never a browser session.
        const payfastMode = process.env.PAYFAST_MODE?.trim().toLowerCase();
        const providerEnvironment = payfastMode === "production" ? "PRODUCTION" : "SANDBOX";
        const credentialVersion = process.env.PAYFAST_CREDENTIAL_VERSION?.trim() || "subscription-config-unresolved";
        const attempt = await tx.paymentAttempt.create({ data: { paymentId: payment.id, publicReference: `pat_${payment.id.slice(-24)}`, attemptNumber: 1, provider: "PAYFAST", idempotencyKey: `subscription-attempt:${invoice.id}`, requestHash: `subscription-invoice:${invoice.id}`, merchantReference: invoice.publicReference, status: "REQUESTING", amount: invoice.total, currency: "ZAR", providerEnvironment, providerProtocolVersion: "payfast-recurring-v1", configurationFingerprint: providerEnvironment === "PRODUCTION" ? "payfast-v1:production" : "payfast-v1:sandbox", providerCredentialVersion: credentialVersion, startedAt: new Date(), version: 0 } });
        await tx.payment.update({ where: { id: payment.id }, data: { provider: "PAYFAST", status: "PROVIDER_PENDING", latestAttemptNumber: 1, version: { increment: 1 } } });
        await tx.paymentStatusHistory.createMany({ data: [
          { paymentId: payment.id, fromStatus: null, toStatus: "CREATED", reasonCode: "SUBSCRIPTION_INITIAL_PAYMENT_PREPARED", actorType: "PAYER", actorId: contract.payerUserId, metadata: { invoiceReference: invoice.publicReference } },
          { paymentId: payment.id, attemptId: attempt.id, fromStatus: "CREATED", toStatus: "PROVIDER_PENDING", reasonCode: "SUBSCRIPTION_RECURRING_ATTEMPT_PREPARED", actorType: "SYSTEM", metadata: { invoiceReference: invoice.publicReference, attemptReference: attempt.publicReference } },
        ] });
        await tx.subscriptionContractStatusHistory.create({ data: { contractId: contract.id, fromStatus: "DRAFT", toStatus: "PENDING_INITIAL_PAYMENT", actorType: "PAYER", actorUserId: contract.payerUserId, operationId: input.operationId, safeMetadata: { acknowledgementReference: acknowledgement.publicReference, authorityReference: authority.publicReference } } });
        await tx.subscriptionEventIntent.create({ data: { publicReference: `subevt_${input.operationId}`, contractId: contract.id, type: "SUBSCRIPTION_AUTHORIZATION_REQUIRED", operationId: input.operationId, safePayload: { invoiceReference: invoice.publicReference } } });
        return { contractReference: contract.publicReference, authorityReference: authority.publicReference, invoiceReference: invoice.publicReference, paymentReference: payment.publicReference, replayed: false };
      });
    },
    async markAuthorizationAction({ contractReference, authorityReference, operationId, safeEvidence }) {
      await database.$transaction(async (tx: any) => {
        const contract = await tx.subscriptionContract.findUnique({ where: { publicReference: contractReference } });
        const authority = await tx.subscriptionPaymentAuthority.findUnique({ where: { publicReference: authorityReference } });
        if (!contract || !authority || authority.contractId !== contract.id) throw new Error("SUBSCRIPTION_AUTHORITY_MISMATCH");
        await tx.subscriptionPaymentAuthority.update({ where: { id: authority.id }, data: { status: "PENDING", version: { increment: 1 } } });
        await tx.subscriptionContract.update({ where: { id: contract.id }, data: { status: "PENDING_INITIAL_PAYMENT", version: { increment: 1 } } });
        await tx.subscriptionContractStatusHistory.upsert({ where: { contractId_operationId: { contractId: contract.id, operationId: `${operationId}:provider-action` } }, create: { contractId: contract.id, fromStatus: contract.status, toStatus: "PENDING_INITIAL_PAYMENT", actorType: "SYSTEM", operationId: `${operationId}:provider-action`, safeMetadata: safeEvidence }, update: {} });
      });
    },
    async getContractForCancellation({ reference, payerUserId, storePayerAuthorised }) {
      const contract = await database.subscriptionContract.findFirst({ where: { publicReference: reference, payerUserId }, select: { id: true, status: true, contractTermType: true, currentPeriodEnd: true, payerUserId: true, publicReference: true, storeId: true } });
      if (!contract || (contract.storeId && !storePayerAuthorised)) return null;
      return contract;
    },
    async scheduleCancellation({ contractId, operationId, effectiveAt, legalPolicyVersion }) {
      await database.$transaction(async (tx: any) => {
        const current = await tx.subscriptionContract.findUnique({ where: { id: contractId } });
        if (!current || current.status === "CANCELLED" || current.status === "EXPIRED") throw new Error("CONTRACT_UNAVAILABLE");
        await tx.subscriptionContract.update({ where: { id: contractId }, data: { status: "CANCELLATION_SCHEDULED", cancellationScheduledAt: new Date(), cancellationEffectiveAt: effectiveAt, version: { increment: 1 } } });
        await tx.subscriptionCancellationNotice.create({ data: { publicReference: `subcancel_${operationId}`, contractId, requestType: "ROLLING_END_OF_PERIOD", proposedEffectiveAt: effectiveAt, legalPolicyVersion } });
        await tx.subscriptionContractStatusHistory.create({ data: { contractId, fromStatus: current.status, toStatus: "CANCELLATION_SCHEDULED", actorType: "PAYER", actorUserId: current.payerUserId, operationId } });
        await tx.subscriptionEventIntent.create({ data: { publicReference: `subevt_${operationId}`, contractId, type: "SUBSCRIPTION_CANCELLATION_SCHEDULED", operationId, safePayload: { effectiveAt: effectiveAt.toISOString() } } });
      });
    },
  });
}

export async function listOfferableSubscriptionPlans(subjectType: SubscriptionSubjectType) {
  const now = new Date();
  const plans = await db.subscriptionPlanVersion.findMany({
    where: {
      status: "ACTIVE",
      program: { subjectType, status: "ACTIVE" },
      OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }],
      AND: [{ OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] }],
    },
    include: {
      program: { select: { publicReference: true, code: true, name: true } },
      benefits: { select: { publicReference: true, benefitType: true, valueType: true, amount: true, quantity: true, usageCap: true, period: true, permittedConsumingPhase: true } },
    },
    orderBy: [{ programId: "asc" }, { versionNumber: "desc" }],
  });
  return plans.filter((plan: any) => plan.contractTermType === "ROLLING_MONTH_TO_MONTH").map((plan: any) => ({ reference: plan.publicReference, program: plan.program, name: plan.displayName, shortDescription: plan.shortDescription, priceAmount: plan.priceAmount.toFixed(2), currency: plan.currency, billingInterval: plan.billingInterval, benefits: plan.benefits.map((benefit: any) => ({ reference: benefit.publicReference, type: benefit.benefitType, valueType: benefit.valueType, amount: benefit.amount?.toFixed(2) ?? null, quantity: benefit.quantity, usageCap: benefit.usageCap, period: benefit.period, consumingPhase: benefit.permittedConsumingPhase })) }));
}
