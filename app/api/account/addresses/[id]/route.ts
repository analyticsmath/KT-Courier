import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  deleteCustomerAddress,
  getCustomerAddress,
  updateCustomerAddress,
} from "@/lib/services/customer-addresses.service";
import { SavedAddressUpdateSchema } from "@/lib/validation/address-book";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  badRequest,
  forbidden,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { UserRole } from "@/types/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.CUSTOMER) {
    return forbidden("This endpoint is for customer accounts.");
  }

  const { id } = await params;

  try {
    const address = await getCustomerAddress(user.id, id);
    if (!address) return notFound("Address not found.");
    return ok({ address });
  } catch {
    return serverError();
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.CUSTOMER) {
    return forbidden("This endpoint is for customer accounts.");
  }

  const rl = await checkIpRateLimit(req, `account-address:${user.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = SavedAddressUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const address = await updateCustomerAddress(user.id, id, parsed.data);
    if (!address) return notFound("Address not found.");
    return ok({ address });
  } catch {
    return serverError();
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.CUSTOMER) {
    return forbidden("This endpoint is for customer accounts.");
  }

  const rl = await checkIpRateLimit(req, `account-address:${user.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  const { id } = await params;

  try {
    const result = await deleteCustomerAddress(user.id, id);
    if (!result.ok && result.reason === "NOT_FOUND") return notFound("Address not found.");
    if (!result.ok && result.reason === "ORDER_SNAPSHOT") {
      return badRequest("This address is tied to an order snapshot and cannot be deleted.");
    }
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
