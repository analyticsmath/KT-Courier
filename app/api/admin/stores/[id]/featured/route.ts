import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getStoreDetail, setStoreFeatured } from "@/lib/services/admin-stores.service";
import { recordAdminActivity } from "@/lib/services/admin-activity.service";
import {
  ok,
  notFound,
  unprocessable,
  serverError,
} from "@/lib/api/response";
import { StoreFeaturedUpdateSchema } from "@/lib/validation/admin";
import { formatZodErrors } from "@/lib/validation/auth";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const originFailure = await enforceSameOriginRequest(req);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.STORES_FEATURE, {
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

  const parsed = StoreFeaturedUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable("Validation failed.", formatZodErrors(parsed.error.issues));
  }

  try {
    const updated = await setStoreFeatured(id, parsed.data.featured);

    await recordAdminActivity({
      actorUserId: session.id,
      action: "UPDATE",
      entityType: "Store",
      entityId: id,
      message: `Set store "${existing.name}" featured = ${parsed.data.featured}`,
      metadata: { featured: parsed.data.featured },
    });

    return ok({ id: updated.id, featured: updated.featured });
  } catch {
    return serverError();
  }
}
