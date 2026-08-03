import type { NextRequest } from "next/server";
import { requestSubscriptionCancellation } from "@/lib/subscriptions/subscription-cancellation.service";
import { createPrismaSubscriptionCancellationRepository } from "@/lib/subscriptions/prisma-subscription-lifecycle.repository";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionStoreReference, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  try {
    const { reference } = await context.params;
    const auth = await requireSubscriptionStoreReference(request, reference, "store_subscriptions.billing"); if (auth.response) return auth.response;
    const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["operationId"]);
    const cancellation = await requestSubscriptionCancellation(createPrismaSubscriptionCancellationRepository(), { contractReference: reference, payerUserId: auth.user.id, storePayerAuthorised: true, operationId: requiredSubscriptionString(body, "operationId", 160), legalPolicyVersion: "subscription-cancellation-v1" });
    return subscriptionJson({ cancellation });
  } catch (error) { return subscriptionApiError(error); }
}
