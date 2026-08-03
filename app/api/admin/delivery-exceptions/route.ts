import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { paginated, serverError } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/response";
import { listDeliveryExceptions } from "@/lib/services/admin-delivery-exceptions.service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const filters = {
    page,
    pageSize,
    search: sp.get("search") ?? undefined,
    driverProfileId: sp.get("driverProfileId") ?? undefined,
    eventType: sp.get("eventType") ?? undefined,
  };

  try {
    const { data, total } = await listDeliveryExceptions(filters);
    return paginated(data, total, page, pageSize);
  } catch (err) {
    console.error("[admin/delivery-exceptions GET]", err);
    return serverError();
  }
}
