import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { updateSettingValue } from "@/lib/services/admin-settings.service";
import { SettingValueUpdateSchema } from "@/lib/validation/admin-settings";
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
  { params }: { params: Promise<{ key: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.SETTINGS_UPDATE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const user = auth.user;

  const { key } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = SettingValueUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const result = await updateSettingValue(user.id, key, parsed.data.value);

    if ("error" in result) {
      if (result.error === "Setting not found.") return notFound(result.error);
      return badRequest(result.error);
    }

    return ok(result.setting);
  } catch {
    return serverError();
  }
}
