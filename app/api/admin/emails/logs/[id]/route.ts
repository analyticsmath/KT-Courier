import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getEmailLogById } from "@/lib/services/email-log.service";
import { ok, notFound, serverError } from "@/lib/api/response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.EMAILS_READ, {
    request: req,
  });
  if (auth.response) return auth.response;

  const { id } = await params;

  try {
    const log = await getEmailLogById(id);
    if (!log) return notFound("Email log not found.");
    return ok(log);
  } catch {
    return serverError();
  }
}
