import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminOrders } from "@/lib/services/admin-orders.service";
import { paginated, parsePagination } from "@/lib/api/response";
import { OrderStatus, OrderSource, DeliveryType } from "@/types/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const { data, total } = await listAdminOrders({
    status: (sp.get("status") as OrderStatus) ?? undefined,
    source: (sp.get("source") as OrderSource) ?? undefined,
    deliveryType: (sp.get("deliveryType") as DeliveryType) ?? undefined,
    search: sp.get("search")?.trim() || undefined,
    page,
    pageSize,
  });

  return paginated(data, total, page, pageSize);
}
