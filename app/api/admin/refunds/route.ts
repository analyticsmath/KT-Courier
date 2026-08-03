import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { refundNoStoreJson, requireRefundAdminPermission } from "@/lib/refunds/api-policy";
import { listFinanceRefunds } from "@/lib/services/refund-query.service";
import { AdminRefundListQuerySchema, refundSearchParams } from "@/lib/validation/refunds";

export async function GET(request: NextRequest) {
  const auth = await requireRefundAdminPermission(PERMISSIONS.REFUNDS_READ, request);
  if ("response" in auth) return auth.response;
  const parsed = AdminRefundListQuerySchema.safeParse(refundSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) return refundNoStoreJson({ error: "Invalid refund filters." }, 422);
  try { return refundNoStoreJson(await listFinanceRefunds(parsed.data)); }
  catch { return refundNoStoreJson({ error: "Refunds are temporarily unavailable." }, 503); }
}

