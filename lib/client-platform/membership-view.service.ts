import { prisma } from "@/lib/db/prisma";
import { storeAccess } from "./store-access";
import { subscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
export async function businessMembershipView(userId: string) {
  const a = await storeAccess(userId, "finance"),
    storeId = a.store.id,
    now = new Date();
  const [contracts, invoices, benefits, plans] = await Promise.all([
    prisma.subscriptionContract.findMany({
      where: { storeId, subjectType: "STORE" },
      select: {
        publicReference: true,
        status: true,
        currency: true,
        contractedPrice: true,
        billingInterval: true,
        billingIntervalCount: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        paidThroughAt: true,
        cancellationEffectiveAt: true,
        planVersion: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.subscriptionInvoice.findMany({
      where: { contract: { storeId, subjectType: "STORE" } },
      select: {
        publicReference: true,
        invoiceNumber: true,
        status: true,
        currency: true,
        subtotal: true,
        taxAmount: true,
        total: true,
        issuedAt: true,
        dueAt: true,
        paidAt: true,
      },
      orderBy: { issuedAt: "desc" },
      take: 200,
    }),
    prisma.subscriptionEntitlementGrant.findMany({
      where: { storeId, subjectType: "STORE", contract: { storeId } },
      select: {
        publicReference: true,
        status: true,
        valueType: true,
        originalAmount: true,
        remainingAmount: true,
        originalQuantity: true,
        remainingQuantity: true,
        effectiveFrom: true,
        effectiveUntil: true,
        benefitDefinition: { select: { benefitType: true } },
      },
      orderBy: { effectiveFrom: "desc" },
      take: 200,
    }),
    prisma.subscriptionPlanVersion.findMany({
      where: {
        status: "ACTIVE",
        program: { subjectType: "STORE", status: "ACTIVE" },
        currency: "ZAR",
        priceAmount: { gt: 0 },
        contractTermType: "ROLLING_MONTH_TO_MONTH",
        AND: [
          { OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: now } }] },
          { OR: [{ effectiveUntil: null }, { effectiveUntil: { gt: now } }] },
        ],
      },
      select: {
        publicReference: true,
        displayName: true,
        shortDescription: true,
        currency: true,
        priceAmount: true,
        billingInterval: true,
        billingIntervalCount: true,
        benefits: {
          select: {
            benefitType: true,
            valueType: true,
            amount: true,
            quantity: true,
            period: true,
            usageCap: true,
          },
        },
      },
      orderBy: { priceAmount: "asc" },
      take: 50,
    }),
  ]);
  return {
    storeId,
    canStartMembership: subscriptionsProductionReady(),
    contracts: contracts.map((c) => ({
      ...c,
      contractedPrice: c.contractedPrice.toFixed(2),
      currentPeriodStart: c.currentPeriodStart?.toISOString() ?? null,
      currentPeriodEnd: c.currentPeriodEnd?.toISOString() ?? null,
      paidThroughAt: c.paidThroughAt?.toISOString() ?? null,
      cancellationEffectiveAt: c.cancellationEffectiveAt?.toISOString() ?? null,
    })),
    invoices: invoices.map((i) => ({
      ...i,
      subtotal: i.subtotal.toFixed(2),
      taxAmount: i.taxAmount.toFixed(2),
      total: i.total.toFixed(2),
      issuedAt: i.issuedAt.toISOString(),
      dueAt: i.dueAt.toISOString(),
      paidAt: i.paidAt?.toISOString() ?? null,
    })),
    benefits: benefits.map((b) => ({
      ...b,
      originalAmount: b.originalAmount?.toFixed(2) ?? null,
      remainingAmount: b.remainingAmount?.toFixed(2) ?? null,
      effectiveFrom: b.effectiveFrom.toISOString(),
      effectiveUntil: b.effectiveUntil.toISOString(),
    })),
    plans: plans.map((p) => ({
      ...p,
      priceAmount: p.priceAmount.toFixed(2),
      benefits: p.benefits.map((b) => ({
        ...b,
        amount: b.amount?.toFixed(2) ?? null,
      })),
    })),
  };
}
