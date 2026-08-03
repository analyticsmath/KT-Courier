import type { NextRequest } from "next/server";
import { requireSubscriptionCustomer, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";
import { listOfferableSubscriptionPlans } from "@/lib/subscriptions/prisma-subscription.repository";

export async function GET(request: NextRequest) {
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try { return subscriptionJson({ plans: await listOfferableSubscriptionPlans("CUSTOMER") }); } catch (error) { return subscriptionApiError(error); }
}
