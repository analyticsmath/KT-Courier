import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getAdminOrderDetail } from "@/lib/services/admin-orders.service";
import { ok, notFound, serverError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    const order = await getAdminOrderDetail(id);
    if (!order) return notFound("Order not found.");
    return ok(order);
  } catch {
    return serverError();
  }
}
