import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { createLegalDocumentDraft, listLegalDocumentVersions } from "@/lib/services/legal-documents.service";

const createSchema = z.object({ documentType: z.string().trim().min(2).max(80), version: z.string().trim().min(1).max(80), jurisdiction: z.string().trim().min(2).max(80), contentHash: z.string().regex(/^[a-f0-9]{64}$/i).optional(), content: z.string().trim().min(1).max(200_000).nullable().optional(), contentReference: z.string().trim().min(1).max(2000).nullable().optional(), acceptancePolicy: z.string().trim().max(160).optional() }).strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_DOCUMENTS_READ, { request });
  if (auth.response) return auth.response;
  return ok({ data: await listLegalDocumentVersions() });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_DOCUMENTS_MANAGE, { request });
  if (auth.response) return auth.response;
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unprocessable("Legal document draft request is invalid.");
  return created({ data: await createLegalDocumentDraft({ actorUserId: auth.user.id, ...parsed.data }) });
}
