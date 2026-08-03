import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { refundNoStoreJson } from "@/lib/refunds/api-policy";
import { getCustomerRefund } from "@/lib/services/refund-query.service";
import { RefundPublicParamsSchema } from "@/lib/validation/refunds";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ publicReference: string }> }) {
  const user = await getCurrentUser();
  if (!user) return refundNoStoreJson({ error: "Authentication required." }, 401);
  if (user.role !== "CUSTOMER" || user.status !== "ACTIVE") return refundNoStoreJson({ error: "Refund not found." }, 404);
  const parameter = RefundPublicParamsSchema.safeParse(await params);
  if (!parameter.success) return refundNoStoreJson({ error: "Refund not found." }, 404);
  try {
    const refund = await getCustomerRefund(user.id, parameter.data.publicReference);
    return refund ? refundNoStoreJson({ refund }) : refundNoStoreJson({ error: "Refund not found." }, 404);
  } catch { return refundNoStoreJson({ error: "Refund is temporarily unavailable." }, 503); }
}

