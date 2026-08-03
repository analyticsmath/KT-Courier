import { getCurrentUser } from "@/lib/auth/current-user";
import { listOwnerPayoutDestinations } from "@/lib/services/withdrawal-query.service";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return withdrawalNoStoreJson({ error: "Authentication required." }, 401);
  try { return withdrawalNoStoreJson({ data: await listOwnerPayoutDestinations(user.id) }); }
  catch { return withdrawalNoStoreJson({ error: "Payout destinations are temporarily unavailable." }, 503); }
}
