/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SUBSCRIPTION_CONTRACTS_RECONCILE, { request }); if (auth.response) return auth.response; try { return subscriptionJson({ cases: await (prisma as any).subscriptionReconciliationCase.findMany({ select: { publicReference: true, reason: true, status: true, priority: true, safeSummary: true, openedAt: true, lastObservedAt: true }, orderBy: { lastObservedAt: "desc" }, take: 100 }) }); } catch (error) { return subscriptionApiError(error); } }
