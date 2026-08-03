import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getContactMessage } from "@/lib/services/admin-contact.service";
import { ok, notFound, serverError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.CONTACTS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    const message = await getContactMessage(id);
    if (!message) return notFound("Contact message not found.");
    return ok(message);
  } catch {
    return serverError();
  }
}
