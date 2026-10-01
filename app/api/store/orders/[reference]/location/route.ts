import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { forbidden, ok, unauthorized } from "@/lib/api/response";
import {
  resolveLocationAccess,
  LocationAccessError,
} from "@/lib/services/location-access.service";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const workspaceDenied = await requireBusinessApi(
    "/api/store/orders/[reference]/location",
  );
  if (workspaceDenied) return workspaceDenied;
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const data = await resolveLocationAccess({
      actorUserId: user.id,
      actorRole: user.role,
      orderId: (await params).reference,
      purpose: "ACTIVE_DELIVERY_TRACKING",
    });
    return ok({
      data: { latestKnownLocation: data.projection, active: data.active },
    });
  } catch (error) {
    return forbidden(
      error instanceof LocationAccessError
        ? error.code
        : "LOCATION_ACCESS_DENIED",
    );
  }
}
