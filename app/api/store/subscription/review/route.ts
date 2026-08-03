import type { NextRequest } from "next/server";
import { createPrismaSubscriptionReviewRepository } from "@/lib/subscriptions/prisma-subscription.repository";
import { reviewSubscriptionPurchase } from "@/lib/subscriptions/subscription-review.service";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionStoreActor, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function POST(request: NextRequest) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  try {
    const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["storeId", "planReference"]); const storeId = requiredSubscriptionString(body, "storeId");
    const auth = await requireSubscriptionStoreActor(request, storeId, "store_subscriptions.billing"); if (auth.response) return auth.response;
    const review = await reviewSubscriptionPurchase(createPrismaSubscriptionReviewRepository(), { planReference: requiredSubscriptionString(body, "planReference"), subjectType: "STORE", customerUserId: null, storeId, payerUserId: auth.user.id, supplierIdentity: { supplierReference: "platform-supplier-v1" }, termsVersion: "subscription-terms-v1", privacyVersion: "privacy-v1" });
    return subscriptionJson({ review }, 201);
  } catch (error) { return subscriptionApiError(error); }
}
