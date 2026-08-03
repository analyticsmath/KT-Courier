import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { updateContactMessageStatus } from "@/lib/services/admin-contact.service";
import { ContactMessageStatus } from "@/types/db";
import { z } from "zod";
import { formatZodErrors } from "@/lib/validation/auth";
import {
  ok,
  notFound,
  unprocessable,
  badRequest,
  serverError,
} from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

const StatusUpdateSchema = z.object({
  status: z.nativeEnum(ContactMessageStatus, { error: "Invalid status value." }),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.CONTACTS_UPDATE, {
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

  const parsed = StatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await updateContactMessageStatus(user.id, id, parsed.data.status);

    if ("error" in result) {
      if (result.error.includes("not found")) return notFound(result.error);
      return badRequest(result.error);
    }

    return ok(result.message);
  } catch {
    return serverError();
  }
}
