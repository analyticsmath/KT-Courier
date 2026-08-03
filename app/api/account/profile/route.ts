import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getCustomerProfile,
  updateCustomerProfile,
} from "@/lib/services/profiles.service";
import {
  ok,
  unauthorized,
  forbidden,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { CustomerProfileUpdateSchema } from "@/lib/validation/profile";
import { formatZodErrors } from "@/lib/validation/auth";
import { UserRole } from "@/types/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.CUSTOMER) return forbidden("This endpoint is for customer accounts.");

  const profile = await getCustomerProfile(session.id);
  return ok(profile);
}

export async function PATCH(req: NextRequest) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();
  if (session.role !== UserRole.CUSTOMER) return forbidden("This endpoint is for customer accounts.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = CustomerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await updateCustomerProfile(session.id, parsed.data);
    return ok(updated);
  } catch {
    return serverError();
  }
}
