import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, created, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { recordIncidentActivity, SecurityIncidentError } from "@/lib/services/operational-incidents.service";
const schema = z.object({ eventType: z.enum(["TRIAGE", "ASSIGNMENT", "INVESTIGATION_NOTE", "REMEDIATION", "PROVIDER_ESCALATION"]), safeNote: z.string().trim().min(2).max(512), operationId: z.string().regex(/^INCOP-[A-Z0-9-]{12,80}$/) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_INCIDENTS_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Incident activity validation failed."); try { return created({ data: await recordIncidentActivity({ actorUserId: auth.user.id, publicReference: (await params).reference, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof SecurityIncidentError ? error.code : "SECURITY_INCIDENT_ACTIVITY_FAILED"); } }
