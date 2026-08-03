/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSubscriptionCustomer, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response; try { const { reference } = await context.params; const grants = await (prisma as any).subscriptionEntitlementGrant.findMany({ where: { contract: { publicReference: reference, customerUserId: auth.user.id } }, select: { publicReference: true, status: true, valueType: true, remainingAmount: true, remainingQuantity: true, effectiveFrom: true, effectiveUntil: true, benefitDefinition: { select: { benefitType: true } } } }); return subscriptionJson({ grants }); } catch (error) { return subscriptionApiError(error); } }
