import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { createPrismaSubscriptionPlanLifecycleRepository } from "@/lib/subscriptions/prisma-subscription-plan.repository";
import { transitionSubscriptionPlanVersion } from "@/lib/subscriptions/subscription-plan.service";
import { subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requiredSubscriptionOperationId } from "@/lib/subscriptions/api-policy";
import type { SubscriptionPlanStatus } from "@/lib/subscriptions/plan-policy";
import { prisma } from "@/lib/db/prisma";
import { runSubscriptionAdministrativeRecoveryInProduction, type SubscriptionAdministrativeRecoveryOperation } from "@/lib/subscriptions/subscription-administrative-recovery.service";

export async function transitionPlanRoute(request: NextRequest, reference: string, permission: string, to: SubscriptionPlanStatus) {
  const auth = await requireAdminApiPermission(permission, { request }); if (auth.response) return auth.response;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return subscriptionJson({ error: "Invalid plan lifecycle request." }, 422);
    const data = body as Record<string, unknown>;
    if (Object.keys(data).some((key) => key !== "operationId" && key !== "rejectionReason") || typeof data.operationId !== "string" || !data.operationId.trim()) return subscriptionJson({ error: "Invalid plan lifecycle request." }, 422);
    const result = await transitionSubscriptionPlanVersion(createPrismaSubscriptionPlanLifecycleRepository(), { reference, to, actorUserId: auth.user.id, operationId: data.operationId.trim(), rejectionReason: typeof data.rejectionReason === "string" ? data.rejectionReason.trim() : undefined });
    return subscriptionJson({ plan: result });
  } catch (error) { return subscriptionApiError(error); }
}

/** Shared narrow guard for every subscription recovery mutation. */
export async function subscriptionRecoveryRoute(request: NextRequest, reference: string, permission: string, operation: SubscriptionAdministrativeRecoveryOperation) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  const auth = await requireAdminApiPermission(permission, { request }); if (auth.response) return auth.response;
  const denied = await prisma.userPermission.findFirst({ where: { userId: auth.user.id, permission: { key: permission }, effect: "DENY" }, select: { id: true } });
  if (denied) return subscriptionJson({ error: "Administrative subscription permission is explicitly denied." }, 403);
  try {
    const body = await readSubscriptionJson(request, 512);
    exactSubscriptionKeys(body, ["operationId"]);
    const result = await runSubscriptionAdministrativeRecoveryInProduction({ contractReference: reference, operation, operationId: requiredSubscriptionOperationId(body) });
    return subscriptionJson({ recovery: result });
  } catch (error) { return subscriptionApiError(error); }
}
