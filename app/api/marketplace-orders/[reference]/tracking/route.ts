import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { notFound, ok, serverError, unauthorized } from "@/lib/api/response";
import { MARKETPLACE_ORDER_COOKIE } from "@/lib/marketplace-checkout/tokens";
import { getMarketplaceDeliveryTracking, MarketplaceDeliveryTrackingError } from "@/lib/services/marketplace-delivery-tracking.service";

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const user = await getCurrentUser();
  const customerUserId = user?.role === "CUSTOMER" ? user.id : undefined;
  const guestSecret = customerUserId ? undefined : request.cookies.get(MARKETPLACE_ORDER_COOKIE)?.value;
  if (!customerUserId && !guestSecret) return unauthorized("Customer order ownership is required.");
  const { reference } = await context.params;
  try {
    return ok(await getMarketplaceDeliveryTracking({ marketplaceOrderReference: reference, customerUserId, guestSecret }));
  } catch (error) {
    if (error instanceof MarketplaceDeliveryTrackingError) return notFound("Order tracking is unavailable.");
    return serverError();
  }
}
