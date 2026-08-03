/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSubscriptionCustomer, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try {
    const contracts = await (prisma as any).subscriptionContract.findMany({ where: { customerUserId: auth.user.id }, select: { publicReference: true, status: true, currentPeriodEnd: true, cancellationEffectiveAt: true, contractedPrice: true, currency: true, planVersion: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } });
    return subscriptionJson({ contracts: contracts.map((contract: any) => ({ reference: contract.publicReference, status: contract.status, currentPeriodEnd: contract.currentPeriodEnd?.toISOString() ?? null, cancellationEffectiveAt: contract.cancellationEffectiveAt?.toISOString() ?? null, recurringAmount: contract.contractedPrice.toFixed(2), currency: contract.currency, planName: contract.planVersion.displayName })) });
  } catch (error) { return subscriptionApiError(error); }
}
