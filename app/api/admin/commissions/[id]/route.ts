import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getCommissionAccrual } from "@/lib/services/commission-query.service";
import { CommissionAccrualParamsSchema } from "@/lib/validation/commissions";
import { commissionNoStoreJson } from "@/lib/commissions/api-policy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSIONS_READ, { request }); if (auth.response) return auth.response;
  const parsed = CommissionAccrualParamsSchema.safeParse(await params); if (!parsed.success) return commissionNoStoreJson({ error: "Commission accrual was not found." }, 404);
  try { const commission = await getCommissionAccrual(parsed.data.id); return commission ? commissionNoStoreJson({ commission }) : commissionNoStoreJson({ error: "Commission accrual was not found." }, 404); }
  catch { return commissionNoStoreJson({ error: "Commission accrual is temporarily unavailable." }, 503); }
}
