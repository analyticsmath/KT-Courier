import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getWithdrawalReconciliation } from "@/lib/services/withdrawal-query.service";
import { WithdrawalReconciliationParamsSchema } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_RECONCILE, { request });
  if (auth.response) return auth.response;
  const parsed = WithdrawalReconciliationParamsSchema.safeParse(await params);
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Withdrawal reconciliation case not found." }, 404);
  try { const caseRow = await getWithdrawalReconciliation(parsed.data.id); return caseRow ? withdrawalNoStoreJson({ reconciliation: caseRow }) : withdrawalNoStoreJson({ error: "Withdrawal reconciliation case not found." }, 404); }
  catch { return withdrawalNoStoreJson({ error: "Withdrawal reconciliation is temporarily unavailable." }, 503); }
}
