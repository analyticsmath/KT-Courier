import { Prisma } from "@prisma/client";
import { MarketplaceCheckoutError } from "./errors";
import { PaymentPolicyError, resolvePaymentBreakdown, type PaymentPolicyContext } from "@/lib/payments/payment-policy.service";

export type MarketplacePaymentPlan = Readonly<{
  version: "marketplace-payment-v1";
  mode: "DIGITAL_ONLY" | "DEPOSIT_PLUS_COD";
  authoritativeTotal: string;
  digitalRequired: string;
  cashRequired: string;
  policyId: string | null;
  policyVersion: number | null;
  policyEvidence: unknown;
}>;
const invalid = () => new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "The frozen marketplace payment split is invalid or unsupported. Review this checkout again.");
const amount = (v: unknown) => typeof v === "string" && /^\d+\.\d{2}$/.test(v) ? new Prisma.Decimal(v) : null;
export function parseMarketplacePaymentPlan(value: unknown): MarketplacePaymentPlan {
  const p = value as MarketplacePaymentPlan | null;
  const total = amount(p?.authoritativeTotal), digital = amount(p?.digitalRequired), cash = amount(p?.cashRequired);
  if (!p || p.version !== "marketplace-payment-v1" || !total || !digital || !cash || !digital.add(cash).equals(total) || !["DIGITAL_ONLY", "DEPOSIT_PLUS_COD"].includes(p.mode)) throw invalid();
  if (p.mode === "DIGITAL_ONLY" ? !cash.isZero() : !digital.gt(0) || !cash.gt(0) || !p.policyId || !Number.isInteger(p.policyVersion) || (p.policyVersion ?? 0) < 1) throw invalid();
  return p;
}
export function digitalMarketplacePaymentPlan(total: string): MarketplacePaymentPlan {
  return { version: "marketplace-payment-v1", mode: "DIGITAL_ONLY", authoritativeTotal: total, digitalRequired: total, cashRequired: "0.00", policyId: null, policyVersion: null, policyEvidence: null };
}
/** Resolve only server-owned prices and quote scope. Missing historical policy
 * preserves digital checkout; a conflicting, invalid or ineligible rule blocks. */
export async function resolveMarketplacePaymentPlan(input: PaymentPolicyContext & { total: string; fulfilmentMode: string; groupCount: number; promotionDiscount?: string }, db: Parameters<typeof resolvePaymentBreakdown>[1]): Promise<MarketplacePaymentPlan> {
  let split;
  try { split = await resolvePaymentBreakdown({ ...input, authoritativeTotal: input.total }, db); }
  catch (error) { if (error instanceof PaymentPolicyError && error.code === "PAYMENT_POLICY_NOT_CONFIGURED" && error.message === "No active payment policy matches this order.") return digitalMarketplacePaymentPlan(input.total); throw error; }
  if (split.mode !== "DIGITAL_ONLY" && (split.mode !== "DEPOSIT_PLUS_COD" || input.groupCount !== 1 || input.fulfilmentMode !== "COURIER_DELIVERY" || new Prisma.Decimal(input.promotionDiscount ?? 0).gt(0))) throw new MarketplaceCheckoutError("CHECKOUT_REVIEW_REQUIRED", "Cash checkout currently requires one approved store with courier delivery and no promotional discount. Choose a digital-only store/service for other checkouts.");
  return parseMarketplacePaymentPlan({ version: "marketplace-payment-v1", mode: split.mode, authoritativeTotal: split.authoritativeTotal, digitalRequired: split.digitalRequired, cashRequired: split.cashRequired, policyId: split.policyId, policyVersion: split.policyVersion, policyEvidence: split.policyEvidence });
}
export function assertMarketplacePaymentPlanTotals(input: { grandTotal: string; digitalRequired?: string | null; cashRequired?: string; groups: readonly { paymentPlan?: unknown; groupTotal: string; fulfilmentMode?: string }[] }): void {
  const cash = new Prisma.Decimal(input.cashRequired ?? 0), digital = new Prisma.Decimal(input.digitalRequired ?? input.grandTotal);
  if (!cash.add(digital).equals(input.grandTotal)) throw invalid();
  const plans = input.groups.map(g => g.paymentPlan ? parseMarketplacePaymentPlan(g.paymentPlan) : digitalMarketplacePaymentPlan(g.groupTotal));
  if (!plans.reduce((sum,p) => sum.add(p.digitalRequired),new Prisma.Decimal(0)).equals(digital) || !plans.reduce((sum,p) => sum.add(p.cashRequired),new Prisma.Decimal(0)).equals(cash) || plans.some((p,i) => !new Prisma.Decimal(p.authoritativeTotal).equals(input.groups[i].groupTotal))) throw invalid();
  if (cash.gt(0) && (plans.length !== 1 || input.groups[0].fulfilmentMode !== "COURIER_DELIVERY" || plans[0].mode !== "DEPOSIT_PLUS_COD")) throw invalid();
}
