import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinancePayoutDestination } from "@/lib/services/withdrawal-query.service";
import { PayoutDestinationParamsSchema } from "@/lib/validation/withdrawals";
import { withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYOUT_DESTINATIONS_READ, { request }); if (auth.response) return auth.response;
  const parsed = PayoutDestinationParamsSchema.safeParse(await params); if (!parsed.success) return withdrawalNoStoreJson({ error: "Payout destination not found." }, 404);
  try { const destination = await getFinancePayoutDestination(parsed.data.id); return destination ? withdrawalNoStoreJson({ payoutDestination: destination }) : withdrawalNoStoreJson({ error: "Payout destination not found." }, 404); }
  catch { return withdrawalNoStoreJson({ error: "Payout destination is temporarily unavailable." }, 503); }
}
