/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SUBSCRIPTION_CONTRACTS_READ, { request }); if (auth.response) return auth.response; try { return subscriptionJson({ contracts: await (prisma as any).subscriptionContract.findMany({ select: { publicReference: true, status: true, subjectType: true, payerUserId: true, currentPeriodEnd: true, cancellationEffectiveAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 100 }) }); } catch (error) { return subscriptionApiError(error); } }
