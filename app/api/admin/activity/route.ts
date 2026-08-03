import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listAdminActivity } from "@/lib/services/admin-activity.service";
import { AdminActionType } from "@/types/db";
import {
  serverError,
  paginated,
  parsePagination,
} from "@/lib/api/response";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.ACTIVITY_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const actionParam = sp.get("action") as AdminActionType | null;
  const entityType = sp.get("entityType") ?? undefined;
  const actorUserId = sp.get("actorUserId") ?? undefined;
  const search = sp.get("search") ?? undefined;

  try {
    const { data, total } = await listAdminActivity({
      action: actionParam ?? undefined,
      entityType,
      actorUserId,
      search,
      page,
      pageSize: Math.min(pageSize, 100),
    });
    return paginated(data, total, page, pageSize);
  } catch {
    return serverError();
  }
}
