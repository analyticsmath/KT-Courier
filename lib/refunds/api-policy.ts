import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db/prisma";
import { RefundError } from "./errors";

export const REFUND_API_BODY_LIMIT = 4_096;

export function refundNoStoreJson<T>(data: T, status = 200): NextResponse<T> {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", "X-Content-Type-Options": "nosniff" } });
}

export function validateRefundJsonRequest(request: NextRequest): NextResponse | null {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  const rawLength = request.headers.get("content-length");
  const length = Number(rawLength ?? "0");
  if (contentType !== "application/json") return refundNoStoreJson({ error: "Content-Type must be application/json." }, 415);
  if (!rawLength || !Number.isFinite(length) || length < 1 || length > REFUND_API_BODY_LIMIT) return refundNoStoreJson({ error: "Request body is too large." }, 413);
  return null;
}

export function refundApiError(error: unknown): NextResponse {
  if (!(error instanceof RefundError)) return refundNoStoreJson({ error: "Refund service is temporarily unavailable." }, 503);
  switch (error.code) {
    case "REFUND_NOT_FOUND":
    case "REFUND_FORBIDDEN": return refundNoStoreJson({ error: "Refund not found." }, 404);
    case "REFUND_IDEMPOTENCY_CONFLICT":
    case "REFUND_PROVIDER_REFERENCE_CONFLICT": return refundNoStoreJson({ error: "Refund action conflicts with existing immutable evidence." }, 409);
    case "REFUND_INVALID_STATE":
    case "REFUND_PROVIDER_OUTCOME_UNKNOWN":
    case "REFUND_CONCURRENCY_CONFLICT": return refundNoStoreJson({ error: "Refund cannot be changed in its current state." }, 409);
    case "REFUND_DUAL_CONTROL_REQUIRED": return refundNoStoreJson({ error: "This refund action requires a separate authorized finance actor." }, 403);
    case "REFUND_PRODUCTION_NOT_READY": return refundNoStoreJson({ error: "Refund operations are inactive pending consolidated validation approval.", blockReason: "CONSOLIDATED_VALIDATION_NOT_APPROVED" }, 503);
    case "REFUND_PROVIDER_NOT_READY": return refundNoStoreJson({ error: "Provider refund execution is inactive pending reviewed production validation.", blockReason: "PAYFAST_REFUNDS_REQUIRE_PRODUCTION_VALIDATION" }, 503);
    case "REFUND_CASH_INSUFFICIENT": return refundNoStoreJson({ error: "External refund accounting requires reconciliation because cash clearing is insufficient." }, 409);
    case "REFUND_AMOUNT_EXCEEDS_REMAINING": return refundNoStoreJson({ error: "Refund amount exceeds the remaining refundable amount." }, 422);
    case "REFUND_PROVIDER_UNSUPPORTED": return refundNoStoreJson({ error: "Original-payment-method refund is unavailable; customer-wallet refund may be requested with customer consent." }, 422);
    case "REFUND_COMMISSION_RELEASED":
    case "REFUND_FUNDING_UNAVAILABLE":
    case "REFUND_LEDGER_INCOHERENT": return refundNoStoreJson({ error: "Refund funding requires finance reconciliation." }, 409);
    default: return refundNoStoreJson({ error: "Refund request is invalid." }, 422);
  }
}

export async function requireRefundAdminPermission(permissionKeys: string | readonly string[], request?: NextRequest) {
  void request;
  const user = await getCurrentUser();
  if (!user) return { response: refundNoStoreJson({ error: "Authentication required." }, 401) } as const;
  if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") return { response: refundNoStoreJson({ error: "Forbidden." }, 403) } as const;
  const keys = typeof permissionKeys === "string" ? [permissionKeys] : [...permissionKeys];
  const denied = await prisma.userPermission.findFirst({ where: { userId: user.id, effect: "DENY", permission: { key: { in: keys } } }, select: { id: true } });
  if (denied) return { response: refundNoStoreJson({ error: "Forbidden." }, 403) } as const;
  if (user.role !== "SUPER_ADMIN") {
    const checks = await Promise.all(keys.map((permissionKey) => hasPermission({ userId: user.id, role: user.role, permissionKey })));
    if (checks.some((allowed) => !allowed)) return { response: refundNoStoreJson({ error: "Forbidden." }, 403) } as const;
  }
  return { user } as const;
}
