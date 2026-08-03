import { getCurrentUser } from "@/lib/auth/current-user";
import { refundNoStoreJson } from "@/lib/refunds/api-policy";
import { getCustomerWalletSummary } from "@/lib/services/customer-wallet.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Customer wallet is unavailable for this account." }, 403);
  try { return refundNoStoreJson({ wallet: await getCustomerWalletSummary(user.id) }); }
  catch { return refundNoStoreJson({ error: "Customer wallet is temporarily unavailable." }, 503); }
}

