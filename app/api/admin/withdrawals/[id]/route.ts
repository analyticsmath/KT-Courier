import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinanceWithdrawal } from "@/lib/services/withdrawal-query.service";
import { WithdrawalAdminParamsSchema } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_READ, { request });
  if (auth.response) return auth.response;
  const parsed = WithdrawalAdminParamsSchema.safeParse(await params);
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
  try { const withdrawal = await getFinanceWithdrawal(parsed.data.id); return withdrawal ? withdrawalNoStoreJson({ withdrawal }) : withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404); }
  catch { return withdrawalNoStoreJson({ error: "Withdrawals are temporarily unavailable." }, 503); }
}
