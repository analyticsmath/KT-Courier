import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { assertContractTransition, assertSubscriptionSubject, rollingCancellationEffectiveAt, type SubscriptionContractStatus, type SubscriptionSubjectType } from "@/lib/subscriptions/contract-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import type { RecurringPaymentProvider } from "@/lib/subscriptions/providers/recurring-payment-provider";

const ref = (prefix: string) => `${prefix}_${randomBytes(12).toString("base64url")}`;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export type AcknowledgedSubscriptionReview = Readonly<{
  id: string; publicReference: string; programId: string; planVersionId: string; subjectType: SubscriptionSubjectType; customerUserId: string | null; storeId: string | null; payerUserId: string; reviewVersion: number; commercialFingerprint: string; status: "CURRENT" | "ACKNOWLEDGED" | "EXPIRED" | "SUPERSEDED"; expiresAt: Date;
  snapshot: Readonly<{ plan: Readonly<{ priceAmount: string; currency: "ZAR"; taxTreatment: string; includedTaxAmount: string | null; billingInterval: "MONTH"; billingIntervalCount: number; contractTermType: "ROLLING_MONTH_TO_MONTH" | "FIXED_TERM"; reference: string }>; policies: Readonly<{ cancellation: string; renewal: string; dunning: string; entitlement: string; legal: string }>; benefits: readonly unknown[]; supplierIdentity: Record<string, unknown> }>;
}>;

export type SubscriptionContractRepository = Readonly<{
  getReview(reference: string, payerUserId: string): Promise<AcknowledgedSubscriptionReview | null>;
  storePayerAuthorised(input: Readonly<{ storeId: string; payerUserId: string }>): Promise<boolean>;
  hasNonTerminalContract(input: Readonly<{ programId: string; customerUserId: string | null; storeId: string | null }>): Promise<boolean>;
  createAcknowledgement(input: Readonly<{ publicReference: string; reviewId: string; actorUserId: string; reviewVersion: number; commercialFingerprint: string; serviceStartConsent: boolean }>): Promise<void>;
  prepareInitialAggregate(input: Readonly<{ contract: Record<string, unknown>; acknowledgement: Record<string, unknown>; authority: Record<string, unknown>; billingCycle: Record<string, unknown>; invoice: Record<string, unknown>; payment: Record<string, unknown>; operationId: string; requestHash: string }>): Promise<Readonly<{ contractReference: string; authorityReference: string; invoiceReference: string; paymentReference: string; replayed: boolean }>>;
  markAuthorizationAction(input: Readonly<{ contractReference: string; authorityReference: string; operationId: string; safeEvidence: Record<string, string> }>): Promise<void>;
  getContractForCancellation(input: Readonly<{ reference: string; payerUserId: string; storePayerAuthorised: boolean }>): Promise<Readonly<{ id: string; status: SubscriptionContractStatus; contractTermType: "ROLLING_MONTH_TO_MONTH" | "FIXED_TERM"; currentPeriodEnd: Date | null; payerUserId: string; publicReference: string }> | null>;
  scheduleCancellation(input: Readonly<{ contractId: string; operationId: string; effectiveAt: Date; legalPolicyVersion: string }>): Promise<void>;
}>;

export async function acknowledgeSubscriptionReview(repository: SubscriptionContractRepository, input: Readonly<{ reviewReference: string; payerUserId: string; commercialFingerprint: string; serviceStartConsent: boolean; at?: Date }>) {
  const review = await repository.getReview(input.reviewReference, input.payerUserId);
  if (!review || review.status !== "CURRENT" || review.expiresAt <= (input.at ?? new Date()) || review.commercialFingerprint !== input.commercialFingerprint) throw new SubscriptionError("SUBSCRIPTION_ACKNOWLEDGEMENT_STALE", "Membership review has changed or expired; review the terms again.");
  const authorised = review.storeId ? await repository.storePayerAuthorised({ storeId: review.storeId, payerUserId: input.payerUserId }) : undefined;
  assertSubscriptionSubject({ subjectType: review.subjectType, customerUserId: review.customerUserId, storeId: review.storeId, payerUserId: input.payerUserId, storePayerAuthorised: authorised });
  await repository.createAcknowledgement({ publicReference: ref("suback"), reviewId: review.id, actorUserId: input.payerUserId, reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint, serviceStartConsent: input.serviceStartConsent });
  return Object.freeze({ reviewReference: review.publicReference, reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint, acknowledgedAt: (input.at ?? new Date()).toISOString() });
}

export async function prepareInitialSubscriptionPayment(repository: SubscriptionContractRepository, provider: RecurringPaymentProvider, input: Readonly<{ reviewReference: string; payerUserId: string; commercialFingerprint: string; payerEmail: string; returnUrl: string; cancelUrl: string; notificationUrl: string; operationId: string; serviceStartConsent: boolean; testApproval?: { approved: true } }>) {
  assertSubscriptionsProductionReady("PROVIDER_AUTHORIZATION", input.testApproval);
  const review = await repository.getReview(input.reviewReference, input.payerUserId);
  if (!review || review.status !== "CURRENT" || review.expiresAt <= new Date() || review.commercialFingerprint !== input.commercialFingerprint) throw new SubscriptionError("SUBSCRIPTION_REVIEW_STALE", "Membership review has changed or expired.");
  const authorised = review.storeId ? await repository.storePayerAuthorised({ storeId: review.storeId, payerUserId: input.payerUserId }) : undefined;
  assertSubscriptionSubject({ subjectType: review.subjectType, customerUserId: review.customerUserId, storeId: review.storeId, payerUserId: input.payerUserId, storePayerAuthorised: authorised });
  if (await repository.hasNonTerminalContract({ programId: review.programId, customerUserId: review.customerUserId, storeId: review.storeId })) throw new SubscriptionError("SUBSCRIPTION_CONTRACT_CONFLICT", "A current membership already exists in this program.");
  if (review.snapshot.plan.contractTermType !== "ROLLING_MONTH_TO_MONTH") throw new SubscriptionError("SUBSCRIPTION_REVIEW_STALE", "Fixed-term activation is source-locked.");
  const now = new Date(); const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()));
  const taxAmount = review.snapshot.plan.includedTaxAmount ?? "0.00";
  const subtotal = new Prisma.Decimal(review.snapshot.plan.priceAmount).minus(taxAmount).toFixed(2);
  const requestHash = hash({ review: review.publicReference, fingerprint: review.commercialFingerprint, payer: input.payerUserId, operation: input.operationId });
  const prepared = await repository.prepareInitialAggregate({
    contract: { publicReference: ref("subcon"), programId: review.programId, planVersionId: review.planVersionId, subjectType: review.subjectType, customerUserId: review.customerUserId, storeId: review.storeId, payerUserId: review.payerUserId, status: "PENDING_PROVIDER_AUTHORIZATION", contractTermType: review.snapshot.plan.contractTermType, currency: "ZAR", contractedPrice: review.snapshot.plan.priceAmount, taxTreatment: review.snapshot.plan.taxTreatment, includedTaxAmount: review.snapshot.plan.includedTaxAmount, billingInterval: "MONTH", billingIntervalCount: 1, commercialFingerprint: review.commercialFingerprint, termSnapshot: review.snapshot },
    acknowledgement: { publicReference: ref("suback"), reviewId: review.id, actorUserId: input.payerUserId, reviewVersion: review.reviewVersion, commercialFingerprint: review.commercialFingerprint, serviceStartConsent: input.serviceStartConsent },
    authority: { publicReference: ref("subauth"), provider: "PAYFAST", mode: "PROVIDER_MANAGED_SUBSCRIPTION", status: "PENDING" },
    billingCycle: { publicReference: ref("subcyc"), cycleNumber: 1, periodStart: now, periodEnd, billingDate: now, status: "PAYMENT_PENDING", currency: "ZAR", amountDue: review.snapshot.plan.priceAmount, amountPaid: "0.00" },
    invoice: { publicReference: ref("subinv"), invoiceNumber: ref("INV"), status: "ISSUED", currency: "ZAR", subtotal, taxAmount, total: review.snapshot.plan.priceAmount, planSnapshot: review.snapshot.plan, benefitSnapshot: review.snapshot.benefits, supplierSnapshot: review.snapshot.supplierIdentity, legalDocumentVersion: review.snapshot.policies.legal, issuedAt: now, dueAt: now },
    payment: { publicReference: ref("pay"), subjectType: "SUBSCRIPTION_INVOICE", payerUserId: review.payerUserId, amount: review.snapshot.plan.priceAmount, currency: "ZAR" }, operationId: input.operationId, requestHash,
  });
  if (prepared.replayed) return Object.freeze({ ...prepared, action: null, replayed: true });
  // PayFast's recurring merchant reference is the immutable invoice, not a
  // generic one-off payment/session reference. Phase 12 resolves it back to
  // its prepared Payment through the subscription invoice boundary.
  const authorization = await provider.createAuthorization({ contractReference: prepared.contractReference, paymentReference: prepared.invoiceReference, amount: review.snapshot.plan.priceAmount, currency: "ZAR", payerReference: review.payerUserId, payerEmail: input.payerEmail, returnUrl: input.returnUrl, cancelUrl: input.cancelUrl, notificationUrl: input.notificationUrl, operationId: input.operationId });
  await repository.markAuthorizationAction({ contractReference: prepared.contractReference, authorityReference: prepared.authorityReference, operationId: input.operationId, safeEvidence: authorization.safeEvidence });
  return Object.freeze({ ...prepared, action: authorization.action, replayed: false });
}

export async function requestSubscriptionCancellation(repository: SubscriptionContractRepository, input: Readonly<{ reference: string; payerUserId: string; storePayerAuthorised: boolean; operationId: string; legalPolicyVersion: string }>) {
  const contract = await repository.getContractForCancellation(input);
  if (!contract || contract.payerUserId !== input.payerUserId) throw new SubscriptionError("SUBSCRIPTION_ACCESS_DENIED", "Membership is not available to this payer.");
  if (contract.contractTermType !== "ROLLING_MONTH_TO_MONTH") throw new SubscriptionError("SUBSCRIPTION_INVALID_INPUT", "Fixed-term cancellation requires its recorded legal review path.");
  assertContractTransition(contract.status, "CANCELLATION_SCHEDULED");
  const effectiveAt = rollingCancellationEffectiveAt(contract.currentPeriodEnd);
  await repository.scheduleCancellation({ contractId: contract.id, operationId: input.operationId, effectiveAt, legalPolicyVersion: input.legalPolicyVersion });
  return Object.freeze({ contractReference: contract.publicReference, status: "CANCELLATION_SCHEDULED" as const, effectiveAt: effectiveAt.toISOString() });
}
