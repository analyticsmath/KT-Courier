import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { notFound, ok } from "@/lib/api/response";
import { getLegalDocumentVersion } from "@/lib/services/legal-documents.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_DOCUMENTS_READ, { request });
  if (auth.response) return auth.response;

  const { reference } = await params;
  const doc = await getLegalDocumentVersion(reference);
  if (!doc) return notFound("Legal document version not found.");
  return ok({ data: doc });
}
