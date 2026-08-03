import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPromotionReconciliations } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * List reconciliation cases
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_READ, { request });
  if (auth.response) return auth.response;

  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const cases = await listPromotionReconciliations(searchParams);
    return NextResponse.json(cases, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Could not load cases", 500);
  }
}
