import type { NextRequest } from "next/server";
import { acknowledgeSubscriptionReview } from "@/lib/subscriptions/subscription-contract.service";
import { createPrismaSubscriptionContractRepository } from "@/lib/subscriptions/prisma-subscription.repository";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionCustomer, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function POST(request: NextRequest) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try {
    const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["reviewReference", "commercialFingerprint", "serviceStartConsent"]);
    if (typeof body.serviceStartConsent !== "boolean") return subscriptionJson({ error: "Invalid membership request." }, 422);
    const acknowledgement = await acknowledgeSubscriptionReview(createPrismaSubscriptionContractRepository(), { reviewReference: requiredSubscriptionString(body, "reviewReference"), payerUserId: auth.user.id, commercialFingerprint: requiredSubscriptionString(body, "commercialFingerprint", 128), serviceStartConsent: body.serviceStartConsent });
    return subscriptionJson({ acknowledgement }, 201);
  } catch (error) { return subscriptionApiError(error); }
}
