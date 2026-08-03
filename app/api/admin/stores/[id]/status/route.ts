import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreDetail, setStoreStatus } from "@/lib/services/admin-stores.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  ok,
  notFound,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { StoreStatusUpdateSchema } from "@/lib/validation/admin";
import { formatZodErrors } from "@/lib/validation/auth";
import { StoreStatus } from "@/types/db";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_APPROVE, {
    request: req,
  });
  if (auth.response) return auth.response;
  const session = auth.user;

  const { id } = await params;
  const existing = await getStoreDetail(id);
  if (!existing) return notFound("Store not found.");

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unprocessable("Invalid request body.");
  }

  const parsed = StoreStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await setStoreStatus(id, parsed.data.status as StoreStatus);

    await recordAdminActivity({
      actorUserId: session.id,
      action: "STATUS_CHANGE",
      entityType: "Store",
      entityId: id,
      message: `Changed store "${existing.name}" status from ${existing.status} to ${parsed.data.status}`,
      metadata: { from: existing.status, to: parsed.data.status },
    });

    return ok({ id: updated.id, status: updated.status });
  } catch {
    return serverError();
  }
}
