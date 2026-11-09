import { type NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { ok, serverError, unprocessable } from "@/lib/api/response";
import { listCustomerLoyaltyLeaderboard } from "@/lib/rewards/customer-loyalty-leaderboard.service";

function boundedPositiveInteger(value: string | null, fallback: number, max: number): number | null {
  if (value === null) return fallback;
  if (!/^[1-9]\d*$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= max ? parsed : null;
}

/** Customer names and point totals are private finance-adjacent admin data. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.CUSTOMERS_READ, { request });
  if (auth.response) return auth.response;

  const page = boundedPositiveInteger(request.nextUrl.searchParams.get("page"), 1, 1000);
  const pageSize = boundedPositiveInteger(request.nextUrl.searchParams.get("pageSize"), 20, 100);
  if (page === null || pageSize === null) return unprocessable("Invalid leaderboard pagination.");
  try {
    const response = ok(await listCustomerLoyaltyLeaderboard({ page, pageSize }));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch {
    return serverError();
  }
}
