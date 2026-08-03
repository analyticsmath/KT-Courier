import type { NextRequest } from "next/server";
import { requestSubscriptionCancellation } from "@/lib/subscriptions/subscription-cancellation.service";
import { createPrismaSubscriptionCancellationRepository } from "@/lib/subscriptions/prisma-subscription-lifecycle.repository";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionCustomer, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try { const { reference } = await context.params; const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["operationId"]); return subscriptionJson({ cancellation: await requestSubscriptionCancellation(createPrismaSubscriptionCancellationRepository(), { contractReference: reference, payerUserId: auth.user.id, storePayerAuthorised: true, operationId: requiredSubscriptionString(body, "operationId", 160), legalPolicyVersion: "subscription-cancellation-v1" }) }); } catch (error) { return subscriptionApiError(error); }
}
