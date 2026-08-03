import { type NextRequest, NextResponse } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { assertPromotionsProductionReady } from "@/lib/promotions/production-lock";
import { resolvePromotionReconciliation } from "@/lib/promotions/admin-promotions.service";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

/**
 * Resolve reconciliation case
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PROMOTIONS_MANAGE, { request });
  if (auth.response) return auth.response;

  try {
    const params = await context.params;
    const body = await request.json();
    assertPromotionsProductionReady("RECONCILIATION");
    const result = await resolvePromotionReconciliation(params.reference, body);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch {
    return errorResponse("Resolve failed", 422);
  }
}
