import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { serverError, paginated, parsePagination } from "@/lib/api/response";
import { listPickupExceptions } from "@/lib/services/admin-pickup-operations.service";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.DISPATCH_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { searchParams } = new URL(req.url);
  const { page, pageSize } = parsePagination(searchParams);
  const driverProfileId = searchParams.get("driverProfileId") ?? undefined;
  const deliveryRegionId = searchParams.get("deliveryRegionId") ?? undefined;

  try {
    const { data, total } = await listPickupExceptions({
      page,
      pageSize,
      driverProfileId,
      deliveryRegionId,
    });

    return paginated(data, total, page, pageSize);
  } catch (err) {
    console.error("[admin/pickup-exceptions GET]", err);
    return serverError();
  }
}
