import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { refundNoStoreJson } from "@/lib/refunds/api-policy";
import { listCustomerWalletTransactions } from "@/lib/services/customer-wallet.service";
import { refundSearchParams, WalletTransactionListQuerySchema } from "@/lib/validation/refunds";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Customer wallet is unavailable for this account." }, 403);
  const parsed = WalletTransactionListQuerySchema.safeParse(refundSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return refundNoStoreJson({ error: "Invalid wallet transaction filters." }, 422);
  try { return refundNoStoreJson(await listCustomerWalletTransactions(user.id, parsed.data)); }
  catch { return refundNoStoreJson({ error: "Wallet transactions are temporarily unavailable." }, 503); }
}

