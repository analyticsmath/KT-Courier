import { createHash, randomBytes } from "node:crypto";
import { assertOfferablePlan } from "@/lib/subscriptions/plan-policy";
import { assertSubscriptionSubject, type SubscriptionSubjectType } from "@/lib/subscriptions/contract-policy";
import { SubscriptionError } from "@/lib/subscriptions/errors";

export type SubscriptionReviewPlan = Readonly<{
  id: string; publicReference: string; programId: string; subjectType: SubscriptionSubjectType; status: "DRAFT" | "UNDER_REVIEW" | "APPROVED" | "ACTIVE" | "REJECTED" | "RETIRED";
  displayName: string; shortDescription: string; fullDescription: string; contractTermType: "ROLLING_MONTH_TO_MONTH" | "FIXED_TERM"; billingInterval: "MONTH"; billingIntervalCount: number;
  priceAmount: string; currency: string; taxTreatment: string; includedTaxAmount: string | null; cancellationPolicyVersion: string; renewalPolicyVersion: string; dunningPolicyVersion: string; entitlementPolicyVersion: string; legalDocumentVersion: string; effectiveFrom: Date | null; effectiveUntil: Date | null;
  benefits: readonly Readonly<{ publicReference: string; benefitType: string; valueType: string; amount: string | null; quantity: number | null; usageCap: number | null; period: string; permittedConsumingPhase: string; stackingPolicy: string; reversalPolicy: string; sourceVersion: string }>[];
}>;

export type SubscriptionReviewRepository = Readonly<{
  resolveActivePlan(input: Readonly<{ planReference: string; subjectType: SubscriptionSubjectType; at: Date }>): Promise<SubscriptionReviewPlan | null>;
  hasNonTerminalContract(input: Readonly<{ programId: string; customerUserId: string | null; storeId: string | null }>): Promise<boolean>;
  storePayerAuthorised(input: Readonly<{ storeId: string; payerUserId: string }>): Promise<boolean>;
  createReview(input: Readonly<{ publicReference: string; programId: string; planVersionId: string; subjectType: SubscriptionSubjectType; customerUserId: string | null; storeId: string | null; payerUserId: string; reviewVersion: number; commercialFingerprint: string; reviewSnapshot: Record<string, unknown>; expiresAt: Date }>): Promise<void>;
}>;

function fingerprint(value: unknown): string { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function reference(prefix: string): string { return `${prefix}_${randomBytes(12).toString("base64url")}`; }

export async function reviewSubscriptionPurchase(repository: SubscriptionReviewRepository, input: Readonly<{ planReference: string; subjectType: SubscriptionSubjectType; customerUserId: string | null; storeId: string | null; payerUserId: string; supplierIdentity: Record<string, unknown>; termsVersion: string; privacyVersion: string; at?: Date }>) {
  const at = input.at ?? new Date();
  const storePayerAuthorised = input.storeId ? await repository.storePayerAuthorised({ storeId: input.storeId, payerUserId: input.payerUserId }) : undefined;
  assertSubscriptionSubject({ ...input, storePayerAuthorised });
  const plan = await repository.resolveActivePlan({ planReference: input.planReference, subjectType: input.subjectType, at });
  if (!plan) throw new SubscriptionError("SUBSCRIPTION_PLAN_NOT_OFFERABLE", "Membership plan was not found.");
  assertOfferablePlan({ ...plan, at });
  if (await repository.hasNonTerminalContract({ programId: plan.programId, customerUserId: input.customerUserId, storeId: input.storeId })) throw new SubscriptionError("SUBSCRIPTION_CONTRACT_CONFLICT", "A current membership already exists in this program.");
  const snapshot = Object.freeze({ plan: { reference: plan.publicReference, displayName: plan.displayName, description: plan.fullDescription, priceAmount: plan.priceAmount, currency: "ZAR", taxTreatment: plan.taxTreatment, includedTaxAmount: plan.includedTaxAmount, billingInterval: plan.billingInterval, billingIntervalCount: plan.billingIntervalCount, contractTermType: plan.contractTermType }, policies: { cancellation: plan.cancellationPolicyVersion, renewal: plan.renewalPolicyVersion, dunning: plan.dunningPolicyVersion, entitlement: plan.entitlementPolicyVersion, legal: plan.legalDocumentVersion, terms: input.termsVersion, privacy: input.privacyVersion }, supplierIdentity: input.supplierIdentity, benefits: plan.benefits, firstCharge: plan.priceAmount, nextRenewal: new Date(at.getUTCFullYear(), at.getUTCMonth() + 1, at.getUTCDate()).toISOString(), coolingOff: "Policy determined from frozen legal terms and service-start consent." });
  const commercialFingerprint = fingerprint({ subjectType: input.subjectType, subject: input.customerUserId ?? input.storeId, payer: input.payerUserId, snapshot });
  const publicReference = reference("subrev");
  await repository.createReview({ publicReference, programId: plan.programId, planVersionId: plan.id, subjectType: input.subjectType, customerUserId: input.customerUserId, storeId: input.storeId, payerUserId: input.payerUserId, reviewVersion: 1, commercialFingerprint, reviewSnapshot: snapshot, expiresAt: new Date(at.getTime() + 15 * 60 * 1000) });
  return Object.freeze({ publicReference, reviewVersion: 1, commercialFingerprint, expiresAt: new Date(at.getTime() + 15 * 60 * 1000).toISOString(), disclosure: snapshot });
}
