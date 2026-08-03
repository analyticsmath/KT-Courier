/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSubscriptionStoreActor, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function GET(request: NextRequest) {
  const storeId = request.nextUrl.searchParams.get("storeId"); if (!storeId) return subscriptionJson({ error: "Store selection is required." }, 422);
  const auth = await requireSubscriptionStoreActor(request, storeId); if (auth.response) return auth.response;
  try { const contract = await (prisma as any).subscriptionContract.findFirst({ where: { storeId, status: { notIn: ["CANCELLED", "EXPIRED"] } }, select: { publicReference: true, status: true, currentPeriodEnd: true, cancellationEffectiveAt: true, contractedPrice: true, currency: true, payerUserId: true, planVersion: { select: { displayName: true } } }, orderBy: { createdAt: "desc" } }); return subscriptionJson({ contract: contract && { reference: contract.publicReference, status: contract.status, currentPeriodEnd: contract.currentPeriodEnd?.toISOString() ?? null, cancellationEffectiveAt: contract.cancellationEffectiveAt?.toISOString() ?? null, recurringAmount: contract.contractedPrice.toFixed(2), currency: contract.currency, payerUserId: contract.payerUserId, planName: contract.planVersion.displayName } }); } catch (error) { return subscriptionApiError(error); }
}
