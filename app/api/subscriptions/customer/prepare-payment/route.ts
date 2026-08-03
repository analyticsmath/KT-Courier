import type { NextRequest } from "next/server";
import { prepareInitialSubscriptionPayment } from "@/lib/subscriptions/subscription-contract.service";
import { resolveSubscriptionProductionComposition } from "@/lib/subscriptions/composition-root";
import { assertSubscriptionsProductionReady } from "@/lib/subscriptions/production-lock";
import { enforceSubscriptionMutation, exactSubscriptionKeys, readSubscriptionJson, requireSubscriptionCustomer, requiredSubscriptionString, subscriptionApiError, subscriptionJson } from "@/lib/subscriptions/api-policy";

export async function POST(request: NextRequest) {
  const limited = await enforceSubscriptionMutation(request); if (limited) return limited;
  const auth = await requireSubscriptionCustomer(request); if (auth.response) return auth.response;
  try {
    assertSubscriptionsProductionReady("INITIAL_PAYMENT");
    const body = await readSubscriptionJson(request); exactSubscriptionKeys(body, ["reviewReference", "commercialFingerprint", "operationId", "serviceStartConsent"]);
    if (typeof body.serviceStartConsent !== "boolean") return subscriptionJson({ error: "Invalid membership request." }, 422);
    const composition = resolveSubscriptionProductionComposition();
    const action = await prepareInitialSubscriptionPayment(composition.contracts, composition.recurringProvider, { reviewReference: requiredSubscriptionString(body, "reviewReference"), payerUserId: auth.user.id, commercialFingerprint: requiredSubscriptionString(body, "commercialFingerprint", 128), payerEmail: auth.user.email, returnUrl: new URL("/membership/checkout", request.url).toString(), cancelUrl: new URL("/membership/checkout", request.url).toString(), notificationUrl: new URL("/api/payments/payfast/itn", request.url).toString(), operationId: requiredSubscriptionString(body, "operationId", 160), serviceStartConsent: body.serviceStartConsent });
    return subscriptionJson({ action });
  } catch (error) { return subscriptionApiError(error); }
}
