import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listUsers } from "@/lib/services/admin-users.service";
import {
  getAdminCustomerDirectoryStats,
  getAdminCustomerSummariesForUserIds,
} from "@/lib/services/admin-customer-directory.service";
import { paginated, parsePagination } from "@/lib/api/response";
import { UserRole, UserStatus } from "@/types/db";

const VALID_ROLES = new Set<string>(Object.values(UserRole));
const VALID_STATUSES = new Set<string>(Object.values(UserStatus));

export async function GET(req: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.USERS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);

  const rawRole = sp.get("role")?.trim();
  const rawStatus = sp.get("status")?.trim();
  const role =
    rawRole && VALID_ROLES.has(rawRole) ? (rawRole as UserRole) : undefined;
  const status =
    rawStatus && VALID_STATUSES.has(rawStatus)
      ? (rawStatus as UserStatus)
      : undefined;
  const search = sp.get("search")?.trim() || undefined;
  const includeSummary =
    sp.get("includeSummary") === "1" || sp.get("includeSummary") === "true";

  const { data, total } = await listUsers({
    role,
    status,
    search,
    page,
    pageSize,
  });

  if (!includeSummary) {
    return paginated(data, total, page, pageSize);
  }

  const customerIds = data
    .filter((user) => user.role === UserRole.CUSTOMER)
    .map((user) => user.id);
  const [directoryStats, customerSummaries] = await Promise.all([
    getAdminCustomerDirectoryStats(),
    getAdminCustomerSummariesForUserIds(customerIds),
  ]);

  return NextResponse.json({
    data: data.map((user) => ({
      ...user,
      customerSummary: customerSummaries.get(user.id) ?? null,
    })),
    directoryStats,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  });
}
