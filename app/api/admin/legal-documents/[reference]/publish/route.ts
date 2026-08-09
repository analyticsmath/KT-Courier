import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { publishLegalDocumentVersion } from "@/lib/services/legal-documents.service";

const schema = z.object({ operationId: z.string().regex(/^LEGALOP-[A-Z0-9-]{12,80}$/), confirmPublication: z.literal("PUBLISH"), effectiveAt: z.string().datetime().optional() }).strict();

export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireAdminApiPermission(PERMISSIONS.LEGAL_DOCUMENTS_PUBLISH, { request });
  if (auth.response) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unprocessable("Legal document publication confirmation is invalid.");
  const { reference } = await params;
  try { return ok({ data: await publishLegalDocumentVersion({ actorUserId: auth.user.id, publicReference: reference, operationId: parsed.data.operationId, effectiveAt: parsed.data.effectiveAt ? new Date(parsed.data.effectiveAt) : undefined }) }); }
  catch { return badRequest("Legal document version could not be published."); }
}
