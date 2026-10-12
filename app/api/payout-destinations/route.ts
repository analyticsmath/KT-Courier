import { getCurrentUser } from "@/lib/auth/current-user";
import { listOwnerPayoutDestinations } from "@/lib/services/withdrawal-query.service";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  if (!["STORE", "DRIVER", "PROMOTER"].includes(user.role)) return withdrawalNoStoreJson({ error: "Payout destinations are unavailable for this account." }, 403);
  try { return withdrawalNoStoreJson({ data: await listOwnerPayoutDestinations(user.id) }); }
  catch (error) { return withdrawalApiError(error); }
}
