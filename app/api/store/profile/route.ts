import { requireBusinessApi } from "@/lib/client-platform/business-auth";
import { type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getStoreProfile,
  updateStoreProfile,
} from "@/lib/services/profiles.service";
import { ok, unauthorized, unprocessable, serverError } from "@/lib/api/response";
import { StoreProfileUpdateSchema } from "@/lib/validation/profile";
import { formatZodErrors } from "@/lib/validation/auth";

import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function GET() {
  const workspaceDenied = await requireBusinessApi("/api/store/profile");
  if (workspaceDenied) return workspaceDenied;
  const session = await getCurrentUser();
  if (!session) return unauthorized();

  const profile = await getStoreProfile(session.id);
  return ok(profile);
}

export async function PATCH(req: NextRequest) {
  const workspaceDenied = await requireBusinessApi("/api/store/profile");
  if (workspaceDenied) return workspaceDenied;
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const session = await getCurrentUser();
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = StoreProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable(
      "Validation failed.",
      formatZodErrors(parsed.error.issues),
    );
  }

  try {
    const updated = await updateStoreProfile(session.id, parsed.data);
    return ok(updated);
  } catch {
    return serverError();
  }
}
