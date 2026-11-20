import { getCurrentUser } from "@/lib/auth/current-user";
import { readPublicQuote } from "@/lib/client-platform/delivery.service";
import { toQuoteDto } from "@/lib/services/pricing-quote.service";
import { json, failure } from "@/lib/client-platform/api";
import { type NextRequest } from "next/server";
import { storeAccess } from "@/lib/client-platform/store-access";
import { resolveExplicitStoreContextId } from "@/lib/payments/customer-api-policy";
import { assertQuoteStoreScope } from "@/lib/client-platform/parcel-quote-store-scope";
import { PlatformError } from "@/lib/client-platform/contracts";
export async function GET(
  req: NextRequest,
  c: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    const q = await readPublicQuote((await c.params).id, user?.id);
    if (q.storeId) {
      if (!user || user.status !== "ACTIVE") throw new PlatformError("STORE_ACCESS_DENIED", "Sign in to view this business quote.", 403);
      const selectedId = resolveExplicitStoreContextId(req);
      assertQuoteStoreScope(q.storeId, selectedId);
      await storeAccess(user.id, "deliveries", selectedId);
    }
    const m = q.metadata as {
      serviceName: string;
      turnaround: string;
      bookingInput: {
        pickupAddress: { line1: string };
        dropoffAddress: { line1: string };
      };
    };
    return json({
      ...toQuoteDto(q),
      serviceName: m.serviceName,
      turnaround: m.turnaround,
      parcelSize: (q.ruleSnapshot as { parcelSize: string }).parcelSize,
      pickupSummary: m.bookingInput.pickupAddress.line1,
      dropoffSummary: m.bookingInput.dropoffAddress.line1,
    });
  } catch (e) {
    return failure(e);
  }
}
