import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  createCustomerAddress,
  listCustomerAddresses,
} from "@/lib/services/customer-addresses.service";
import { SavedAddressCreateSchema } from "@/lib/validation/address-book";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  created,
  forbidden,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
  unprocessable,
} from "@/lib/api/response";
import { checkIpRateLimit, RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { UserRole } from "@/types/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.CUSTOMER) {
    return forbidden("This endpoint is for customer accounts.");
  }

  try {
    const addresses = await listCustomerAddresses(user.id);
    return ok({ addresses });
  } catch {
    return serverError();
  }
}

export async function POST(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== UserRole.CUSTOMER) {
    return forbidden("This endpoint is for customer accounts.");
  }

  const rl = await checkIpRateLimit(req, `account-address:${user.id}`, RATE_LIMITS.ADDRESS_MUTATION);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = SavedAddressCreateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const address = await createCustomerAddress(user.id, parsed.data);
    return created({ address });
  } catch {
    return serverError();
  }
}
