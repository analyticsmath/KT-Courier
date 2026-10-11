import { Prisma, type PaymentMethodPolicy } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { BankInstructionsSchema } from "@/lib/client-platform/driver-cash.service";
export type PaymentPolicyContext = Readonly<{
  businessModuleId?: string | null;
  storeId?: string | null;
  deliveryServiceId?: string | null;
  deliveryServiceKey?: string | null;
  orderType?: string | null;
  provinces?: readonly string[];
  regionId?: string | null;
  orderId?: string | null;
}>;
export class PaymentPolicyError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
type PolicyDb = Pick<Prisma.TransactionClient, "paymentMethodPolicy" | "store"> & Partial<Pick<Prisma.TransactionClient, "systemSetting">>;
export function paymentPolicyScope(
  p: Pick<
    PaymentMethodPolicy,
    | "businessModuleId"
    | "storeId"
    | "deliveryServiceId"
    | "orderType"
    | "provinceScope"
    | "regionId"
    | "orderId"
  >,
) {
  return JSON.stringify([
    p.businessModuleId ?? null,
    p.storeId ?? null,
    p.deliveryServiceId ?? null,
    p.orderType ?? null,
    Array.isArray(p.provinceScope)
      ? [...p.provinceScope].sort()
      : (p.provinceScope ?? null),
    p.regionId ?? null,
    p.orderId ?? null,
  ]);
}
function specificity(p: PaymentMethodPolicy) {
  return (
    (p.orderId ? 100 : 0) +
    [
      p.businessModuleId,
      p.storeId,
      p.deliveryServiceId,
      p.orderType,
      p.provinceScope,
      p.regionId,
    ].filter(Boolean).length
  );
}
function compatible(p: PaymentMethodPolicy, c: PaymentPolicyContext) {
  if (
    p.provinceScope != null &&
    (!Array.isArray(p.provinceScope) ||
      !p.provinceScope.length ||
      !c.provinces?.length ||
      !c.provinces.every((v) => (p.provinceScope as unknown[]).includes(v)))
  )
    return false;
  return (
    (!p.businessModuleId || p.businessModuleId === c.businessModuleId) &&
    (!p.storeId || p.storeId === c.storeId) &&
    (!p.deliveryServiceId ||
      [c.deliveryServiceId, c.deliveryServiceKey].includes(
        p.deliveryServiceId,
      )) &&
    (!p.orderType || p.orderType === c.orderType) &&
    (!p.regionId || p.regionId === c.regionId) &&
    (!p.orderId || p.orderId === c.orderId)
  );
}
export async function resolvePaymentPolicy(
  context: PaymentPolicyContext,
  now = new Date(),
  db: PolicyDb = prisma,
) {
  const candidates = await db.paymentMethodPolicy.findMany({
    where: {
      status: "ACTIVE",
      effectiveFrom: { lte: now },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
    },
  });
  const current = new Map<string, PaymentMethodPolicy>();
  for (const p of candidates.filter((p) => compatible(p, context))) {
    const key = paymentPolicyScope(p),
      prior = current.get(key);
    if (prior?.versionNumber === p.versionNumber)
      throw new PaymentPolicyError(
        "PAYMENT_POLICY_CONFLICT",
        "Duplicate policy versions require review.",
      );
    if (!prior || p.versionNumber > prior.versionNumber) current.set(key, p);
  }
  const sorted = [...current.values()].sort(
      (a, b) => specificity(b) - specificity(a),
    ),
    p = sorted[0];
  if (!p)
    throw new PaymentPolicyError(
      "PAYMENT_POLICY_NOT_CONFIGURED",
      "No active payment policy matches this order.",
    );
  if (sorted[1] && specificity(sorted[1]) === specificity(p))
    throw new PaymentPolicyError(
      "PAYMENT_POLICY_CONFLICT",
      "Overlapping payment policies require review.",
    );
  return p;
}
export async function resolvePaymentBreakdown(
  input: PaymentPolicyContext & {
    authoritativeTotal: string;
    digitalAlreadyPaid?: string;
    now?: Date;
  },
  db: PolicyDb = prisma,
) {
  const total = new Prisma.Decimal(input.authoritativeTotal),
    paid = new Prisma.Decimal(input.digitalAlreadyPaid ?? 0);
  if (
    !total.isFinite() ||
    !paid.isFinite() ||
    total.isNegative() ||
    paid.isNegative() ||
    total.decimalPlaces() > 2 ||
    paid.decimalPlaces() > 2 ||
    paid.gt(total)
  )
    throw new PaymentPolicyError(
      "PAYMENT_METHOD_NOT_ALLOWED",
      "Authoritative payment amounts are invalid.",
    );
  const p = await resolvePaymentPolicy(input, input.now, db),
    mode = p.mode === "DIGITAL" ? "DIGITAL_ONLY" : p.mode;
  if (mode !== "DIGITAL_ONLY") {
    const production = process.env.NODE_ENV === "production" && process.env.KT_RUNTIME_ENV !== "e2e";
    if (production) {
      const evidence = p.policyEvidence as { approvedByUserId?: string; approvedAt?: string; remittanceApproved?: boolean; remittanceUpdatedAt?: string; settlementTiming?: string } | null;
      if (!p.deliveryServiceId || (!p.regionId && (!Array.isArray(p.provinceScope) || !p.provinceScope.length)) || mode !== "DEPOSIT_PLUS_COD" || !p.depositPercent?.equals("0.5") || !evidence?.approvedByUserId || evidence.approvedByUserId === p.createdByUserId || !evidence.approvedAt || !evidence.remittanceApproved) {
        throw new PaymentPolicyError("COD_PRODUCTION_APPROVAL_REQUIRED", "Production cash requires independent approval of the 50/50 split, service/region scope, and remittance operations.");
      }
      const bank = await db.systemSetting?.findUnique({ where: { key: "client_cash_deposit_bank" }, select: { value: true, updatedAt: true } });
      if (!bank || !BankInstructionsSchema.safeParse(bank.value).success || bank.updatedAt.toISOString() !== evidence.remittanceUpdatedAt || !evidence.settlementTiming) throw new PaymentPolicyError("COD_REMITTANCE_NOT_CONFIGURED", "Approved secure remittance instructions are required before cash checkout. Changed instructions require renewed policy approval.");
    }
    if (!input.storeId || p.storeId !== input.storeId)
      throw new PaymentPolicyError(
        "COD_BUSINESS_NOT_APPROVED",
        "Cash requires an explicitly approved business.",
      );
    const s = await db.store.findUnique({
      where: { id: input.storeId },
      select: {
        status: true,
        ownerUser: { select: { status: true, emailVerifiedAt: true } },
      },
    });
    if (
      s?.status !== "ACTIVE" ||
      s.ownerUser?.status !== "ACTIVE" ||
      !s.ownerUser.emailVerifiedAt
    )
      throw new PaymentPolicyError(
        "COD_BUSINESS_NOT_APPROVED",
        "Cash requires an active approved business with a verified owner.",
      );
  }
  let required = total;
  if (mode === "FULL_COD") required = new Prisma.Decimal(0);
  if (mode === "DEPOSIT_PLUS_COD") {
    if (p.depositAmount != null && p.depositPercent != null)
      throw new PaymentPolicyError(
        "PAYMENT_POLICY_NOT_CONFIGURED",
        "Configure one deposit method.",
      );
    if (p.depositAmount != null) required = p.depositAmount;
    else if (p.depositPercent?.gt(0) && p.depositPercent.lt(1))
      required = total
        .mul(p.depositPercent)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    else
      throw new PaymentPolicyError(
        "PAYMENT_POLICY_NOT_CONFIGURED",
        "Configure a valid deposit split.",
      );
    if (required.lte(0) || required.gte(total))
      throw new PaymentPolicyError(
        "PAYMENT_METHOD_NOT_ALLOWED",
        "This total is not eligible for the deposit split.",
      );
  }
  if (required.isNegative() || required.gt(total) || paid.gt(required))
    throw new PaymentPolicyError(
      "PAYMENT_METHOD_NOT_ALLOWED",
      "The payment split is invalid.",
    );
  const cash = total.sub(required);
  if (
    mode !== "DIGITAL_ONLY" &&
    (!p.maximumCodAmount || p.maximumCodAmount.lte(0))
  )
    throw new PaymentPolicyError(
      "PAYMENT_POLICY_NOT_CONFIGURED",
      "Cash policies require a positive limit.",
    );
  if (mode !== "DIGITAL_ONLY" && cash.gt(p.maximumCodAmount!))
    throw new PaymentPolicyError(
      "COD_LIMIT_EXCEEDED",
      "Required cash exceeds the configured maximum.",
    );
  return Object.freeze({
    mode,
    policyId: p.id,
    policyVersion: p.versionNumber,
    authoritativeTotal: total.toFixed(2),
    digitalRequired: required.toFixed(2),
    digitalPaid: paid.toFixed(2),
    cashRequired: cash.toFixed(2),
    cashOutstanding: cash.toFixed(2),
    policyEvidence: {
      id: p.id,
      version: p.versionNumber,
      mode,
      depositAmount: p.depositAmount?.toFixed(2) ?? null,
      depositPercent: p.depositPercent?.toString() ?? null,
      maximumCodAmount: p.maximumCodAmount?.toFixed(2) ?? null,
    },
  });
}
