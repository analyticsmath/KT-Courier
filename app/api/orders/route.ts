import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { createOrder, listOrders } from "@/lib/services/orders.service";
import { CreateOrderSchema } from "@/lib/validation/order";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  created,
  unauthorized,
  forbidden,
  unprocessable,
  serverError,
  paginated,
  conflict,
  parsePagination,
  tooManyRequests,
} from "@/lib/api/response";
import { OrderStatus } from "@/types/db";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { PricingError } from "@/lib/pricing/errors";

const ALLOWED_ROLES = ["CUSTOMER", "STORE"] as const;

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) return forbidden();

  // Rate limit by user ID to prevent order flooding from authenticated users
  const rl = await checkIpRateLimit(req, `order-create:${user.id}`, RATE_LIMITS.ORDER_CREATE);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const order = await createOrder(user, parsed.data);
    return created(order);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "No store found for this account.") {
      return forbidden("No store account found. Please complete your store profile.");
    }
    if (err instanceof PricingError) {
      if (err.status === 403) return forbidden(err.message);
      if (err.status === 409) return conflict(err.message);
      return unprocessable(err.message, { code: err.code });
    }
    return serverError();
  }
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (!ALLOWED_ROLES.includes(user.role as (typeof ALLOWED_ROLES)[number])) return forbidden();

  const sp = req.nextUrl.searchParams;
  const { page, pageSize } = parsePagination(sp);
  const statusParam = sp.get("status") as OrderStatus | null;

  const { data, total } = await listOrders(user, {
    status: statusParam ?? undefined,
    page,
    pageSize,
  });

  return paginated(data, total, page, pageSize);
}
