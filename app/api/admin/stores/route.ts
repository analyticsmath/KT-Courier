import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listStores } from "@/lib/services/admin-stores.service";
import { paginated, parsePagination } from "@/lib/api/response";
import { StoreStatus } from "@/types/db";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const status = sp.get("status") as StoreStatus | null;
  const featuredParam = sp.get("featured");
  const featured =
    featuredParam === "true" ? true : featuredParam === "false" ? false : undefined;
  const search = sp.get("search")?.trim() || undefined;

  const { data, total } = await listStores({
    status: status ?? undefined,
    featured,
    search,
    page,
    pageSize,
  });

  return paginated(data, total, page, pageSize);
}
