import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import {
  getStoreDetail,
  adminUpdateStore,
} from "@/lib/services/admin-stores.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  ok,
  notFound,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { AdminStoreUpdateSchema } from "@/lib/validation/admin";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;
  const detail = await getStoreDetail(id);
  if (!detail) return notFound("Store not found.");

  return ok(detail);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_UPDATE, {
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

  const parsed = AdminStoreUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await adminUpdateStore(id, parsed.data);

    await recordAdminActivity({
      actorUserId: session.id,
      action: "UPDATE",
      entityType: "Store",
      entityId: id,
      message: `Updated store "${existing.name}"`,
      metadata: { changes: Object.keys(parsed.data) },
    });

    return ok(updated);
  } catch {
    return serverError();
  }
}
