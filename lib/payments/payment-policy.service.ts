import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type PaymentPolicyContext = Readonly<{ businessModuleId?: string | null; storeId?: string | null; deliveryServiceId?: string | null; orderType?: string | null }>;
export class PaymentPolicyError extends Error { constructor(readonly code: string, message: string) { super(message); } }

function specificity(policy: { businessModuleId: string | null; storeId: string | null; deliveryServiceId: string | null; orderType: string | null }) {
  return [policy.businessModuleId, policy.storeId, policy.deliveryServiceId, policy.orderType].filter(Boolean).length;
}
function compatible(policy: { businessModuleId: string | null; storeId: string | null; deliveryServiceId: string | null; orderType: string | null }, context: PaymentPolicyContext) {
  return (!policy.businessModuleId || policy.businessModuleId === context.businessModuleId)
    && (!policy.storeId || policy.storeId === context.storeId)
    && (!policy.deliveryServiceId || policy.deliveryServiceId === context.deliveryServiceId)
    && (!policy.orderType || policy.orderType === context.orderType);
}

/** Canonical commercial-policy resolver: global policy, then the most-specific compatible context. */
export async function resolvePaymentPolicy(context: PaymentPolicyContext, now = new Date()) {
  const candidates = await prisma.paymentMethodPolicy.findMany({
    where: { status: "ACTIVE", effectiveFrom: { lte: now }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }] },
  });
  const policy = candidates.filter((item) => compatible(item, context)).sort((a, b) => specificity(b) - specificity(a) || b.versionNumber - a.versionNumber)[0];
  if (!policy) throw new PaymentPolicyError("PAYMENT_POLICY_NOT_CONFIGURED", "No active payment policy is configured for this order.");
  return policy;
}

export async function resolvePaymentBreakdown(input: PaymentPolicyContext & { authoritativeTotal: string; digitalAlreadyPaid?: string; now?: Date }) {
  const total = new Prisma.Decimal(input.authoritativeTotal); const digitalPaid = new Prisma.Decimal(input.digitalAlreadyPaid ?? "0");
  if (total.isNegative() || digitalPaid.isNegative() || digitalPaid.greaterThan(total)) throw new PaymentPolicyError("PAYMENT_METHOD_NOT_ALLOWED", "Authoritative payment amounts are invalid.");
  const policy = await resolvePaymentPolicy(input, input.now);
  const mode = policy.mode === "DIGITAL" ? "DIGITAL_ONLY" : policy.mode;
  if (policy.mode !== "DIGITAL" && policy.maximumCodAmount && total.greaterThan(policy.maximumCodAmount)) throw new PaymentPolicyError("COD_LIMIT_EXCEEDED", "This order exceeds the configured COD maximum.");
  let digitalRequired = total;
  if (policy.mode === "FULL_COD") digitalRequired = new Prisma.Decimal(0);
  if (policy.mode === "DEPOSIT_PLUS_COD") {
    if (policy.depositAmount) digitalRequired = policy.depositAmount;
    else if (policy.depositPercent) digitalRequired = total.mul(policy.depositPercent).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    else throw new PaymentPolicyError("PAYMENT_POLICY_NOT_CONFIGURED", "Deposit-plus-COD policy has no deposit configuration.");
  }
  if (digitalRequired.greaterThan(total)) throw new PaymentPolicyError("PAYMENT_POLICY_NOT_CONFIGURED", "Payment policy requires more than the authoritative order total.");
  const cashRequired = total.sub(digitalRequired);
  return Object.freeze({ mode, policyId: policy.id, policyVersion: policy.versionNumber, authoritativeTotal: total.toFixed(2), digitalRequired: digitalRequired.toFixed(2), digitalPaid: digitalPaid.toFixed(2), cashRequired: cashRequired.toFixed(2), cashOutstanding: Prisma.Decimal.max(cashRequired, new Prisma.Decimal(0)).toFixed(2), policyEvidence: { id: policy.id, version: policy.versionNumber, mode, depositAmount: policy.depositAmount?.toFixed(2) ?? null, depositPercent: policy.depositPercent?.toString() ?? null, maximumCodAmount: policy.maximumCodAmount?.toFixed(2) ?? null } });
}
