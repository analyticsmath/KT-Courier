import { type NextRequest } from "next/server";
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
  { params }: { params: Promise<{ id: string }> }
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
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  const result = await cancelOrder(user, id, parsed.data);

  if ("error" in result) {
    if (result.error === "Order not found.") return notFound(result.error);
    return badRequest(result.error);
  }

  return ok(result.order);
}
