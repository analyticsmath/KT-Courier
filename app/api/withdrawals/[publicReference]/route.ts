import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnerWithdrawal } from "@/lib/services/withdrawal-query.service";
import { WithdrawalPublicParamsSchema } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  const parsed = WithdrawalPublicParamsSchema.safeParse(await params);
  if (!parsed.success) return withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
  try {
    const withdrawal = await getOwnerWithdrawal(user.id, parsed.data.publicReference);
    return withdrawal ? withdrawalNoStoreJson({ withdrawal }) : withdrawalNoStoreJson({ error: "Withdrawal not found." }, 404);
  } catch { return withdrawalNoStoreJson({ error: "Withdrawals are temporarily unavailable." }, 503); }
}
