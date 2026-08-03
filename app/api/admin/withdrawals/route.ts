import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listFinanceWithdrawals } from "@/lib/services/withdrawal-query.service";
import { AdminWithdrawalListQuerySchema, withdrawalSearchParams } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.WITHDRAWALS_READ, { request });
  if (auth.response) return auth.response;
  const parsed = AdminWithdrawalListQuerySchema.safeParse(withdrawalSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Invalid withdrawal filters." }, 422);
  try { return withdrawalNoStoreJson(await listFinanceWithdrawals(parsed.data)); }
  catch { return withdrawalNoStoreJson({ error: "Withdrawals are temporarily unavailable." }, 503); }
}
