import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import type { NextRequest } from "next/server";
import { listOfferableSubscriptionPlans } from "@/lib/subscriptions/prisma-subscription.repository";
import {
  requireSubscriptionStoreActor,
  subscriptionApiError,
  subscriptionJson,
} from "@/lib/subscriptions/api-policy";

export async function GET(request: NextRequest) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/subscription-plans",
  );
  if (workspaceDenied) return workspaceDenied;
  const storeId = request.nextUrl.searchParams.get("storeId");
  if (!storeId)
    return subscriptionJson({ error: "Store selection is required." }, 422);
  const auth = await requireSubscriptionStoreActor(request, storeId);
  if (auth.response) return auth.response;
  try {
    return subscriptionJson({
      plans: await listOfferableSubscriptionPlans("STORE"),
    });
  } catch (error) {
    return subscriptionApiError(error);
  }
}
