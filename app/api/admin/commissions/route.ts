import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissions } from "@/lib/services/commission-query.service";
import { CommissionListQuerySchema, commissionSearchParams } from "@/lib/validation/commissions";
import { commissionNoStoreJson } from "@/lib/commissions/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSIONS_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionListQuerySchema.safeParse(commissionSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return commissionNoStoreJson({ error: "Invalid commission filters." }, 422);
  try { return commissionNoStoreJson(await listCommissions(parsed.data)); }
  catch { return commissionNoStoreJson({ error: "Commissions are temporarily unavailable." }, 503); }
}
