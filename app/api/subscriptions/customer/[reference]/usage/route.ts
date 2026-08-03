/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireSubscriptionCustomer, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response; try { const { reference } = await context.params; const usage = await (prisma as any).subscriptionEntitlementUsage.findMany({ where: { grant: { contract: { publicReference: reference, customerUserId: auth.user.id } } }, select: { publicReference: true, action: true, amount: true, quantity: true, sourceType: true, sourceReference: true, createdAt: true }, orderBy: { createdAt: "desc" } }); return subscriptionJson({ usage }); } catch (error) { return subscriptionApiError(error); } }
