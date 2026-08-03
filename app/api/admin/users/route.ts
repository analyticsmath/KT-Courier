import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listUsers } from "@/lib/services/admin-users.service";
import { paginated } from "@/lib/api/response";
import { parsePagination } from "@/lib/api/response";
import { UserRole, UserStatus } from "@/types/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.USERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const role = sp.get("role") as UserRole | null;
  const status = sp.get("status") as UserStatus | null;
  const search = sp.get("search")?.trim() || undefined;

  const { data, total } = await listUsers({
    role: role ?? undefined,
    status: status ?? undefined,
    search,
    page,
    pageSize,
  });

  return paginated(data, total, page, pageSize);
}
