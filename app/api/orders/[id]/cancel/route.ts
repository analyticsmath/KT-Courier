import { resolveExplicitStoreContextId, paymentApiError } from "@/lib/payments/customer-api-policy";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelOrder } from "@/lib/services/orders.service";
import { CustomerCancelOrderSchema } from "@/lib/validation/order";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  unauthorized,
  forbidden,
  notFound,
  unprocessable,
  badRequest,
} from "@/lib/api/response";
import { UserRole } from "@/types/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const ALLOWED_ROLES: UserRole[] = [UserRole.CUSTOMER, UserRole.STORE];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role)) return forbidden();

  const { id } = await params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // Empty body is allowed — reason is optional
  }

  const parsed = CustomerCancelOrderSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable(
      "Validation failed.",
      formatZodErrors(parsed.error.issues),
    );
  }

  let explicitStoreId: string | null = null;
  try {
    explicitStoreId = resolveExplicitStoreContextId(req, parsed.data.storeContextId);
  } catch (err) {
    return paymentApiError(err);
  }

  const businessWorkspace =
    user.role === "STORE" ||
    req.headers.get("X-KT-Workspace") === "STORE" ||
    Boolean(explicitStoreId);

  let result: Awaited<ReturnType<typeof cancelOrder>>;
  try {
    result = await cancelOrder(user, id, parsed.data, businessWorkspace, {
      explicitStoreId,
    });
  } catch (err) {
    return paymentApiError(err);
  }

  if ("error" in result) {
    if (result.conflictCode === "CANCELLATION_PENDING_PAYMENT_RESOLUTION") {
      return NextResponse.json(
        {
          error: result.error,
          code: result.conflictCode,
          ...(result.resolution ? { resolution: result.resolution } : {}),
        },
        { status: 409 },
      );
    }
    if (result.error === "Order not found.") return notFound(result.error);
    return badRequest(result.error);
  }

  return ok({
    ...result.order,
    ...(result.resolution ? { cancellationResolution: result.resolution } : {}),
  });
}
