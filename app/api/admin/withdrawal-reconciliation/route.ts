import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";
import { WithdrawalReconciliationListQuerySchema, withdrawalSearchParams } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_RECONCILE, { request });
  if (auth.response) return auth.response;
  const parsed = WithdrawalReconciliationListQuerySchema.safeParse(withdrawalSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid withdrawal reconciliation filters." }, 422);
  try { return withdrawalNoStoreJson(await listWithdrawalReconciliation(parsed.data)); }
  catch { return withdrawalNoStoreJson({ error: "Withdrawal reconciliation is temporarily unavailable." }, 503); }
}
