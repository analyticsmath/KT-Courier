import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOrder } from "@/lib/services/orders.service";
import { ok, unauthorized, forbidden, notFound, serverError } from "@/lib/api/response";

const ALLOWED_ROLES = ["CUSTOMER", "STORE"] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) return forbidden();

  const { id } = await params;

  try {
    const order = await getOrder(user, id);
    if (!order) return notFound("Order not found.");
    return ok(order);
  } catch {
    return serverError();
  }
}
