import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { updateAdminOrderStatus } from "@/lib/services/admin-orders.service";
import { AdminOrderStatusUpdateSchema } from "@/lib/validation/order";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  notFound,
  unprocessable,
  badRequest,
  serverError,
} from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.ORDERS_STATUS_MANAGE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = AdminOrderStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await updateAdminOrderStatus(user, id, {
      status: parsed.data.status,
      note: parsed.data.note,
      internalNote: parsed.data.internalNote,
    });

    if ("error" in result) {
      if (result.error === "Order not found.") return notFound(result.error);
      return badRequest(result.error);
    }

    return ok(result.order);
  } catch {
    return serverError();
  }
}
