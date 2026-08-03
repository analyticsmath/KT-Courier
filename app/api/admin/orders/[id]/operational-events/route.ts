import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ok, serverError } from "@/lib/api/response";
import { getOrderOperationalEvents } from "@/lib/services/admin-pickup-operations.service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id: orderId } = await params;

  try {
    const events = await getOrderOperationalEvents(orderId);
    return ok({ events });
  } catch (err) {
    console.error("[admin/orders/[id]/operational-events GET]", err);
    return serverError();
  }
}
