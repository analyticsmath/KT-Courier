import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { attachIncidentEvidence, getOperationalIncidentId, SecurityIncidentError } from "@/lib/services/operational-incidents.service";
import { phase5Repository } from "@/lib/operations/phase5-repository";
const schema = z.object({ privateMediaObjectId: z.string().cuid().optional(), evidenceType: z.string().trim().min(2).max(80), safeReference: z.string().trim().max(160).optional(), operationId: z.string().regex(/^INCOP-[A-Z0-9-]{12,80}$/) }).strict();
export async function GET(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_INCIDENTS_SENSITIVE_EVIDENCE, { request }); if (auth.response) return auth.response; const incidentId = await getOperationalIncidentId((await params).reference); if (!incidentId) return badRequest("SECURITY_INCIDENT_NOT_FOUND"); return ok({ data: await phase5Repository.operationalIncidentEvidence.findMany({ where: { incidentId }, orderBy: { createdAt: "asc" } }) }); }
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_INCIDENTS_SENSITIVE_EVIDENCE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success || (!parsed.data.privateMediaObjectId && !parsed.data.safeReference)) return unprocessable("Incident evidence validation failed."); try { return created({ data: await attachIncidentEvidence({ actorUserId: auth.user.id, publicReference: (await params).reference, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof SecurityIncidentError ? error.code : "SECURITY_INCIDENT_EVIDENCE_FAILED"); } }
