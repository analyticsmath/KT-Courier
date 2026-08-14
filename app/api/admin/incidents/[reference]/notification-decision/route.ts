import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { recordIncidentNotificationDecision, SecurityIncidentError } from "@/lib/services/operational-incidents.service";
const schema = z.object({ decision: z.enum(["NOT_REQUIRED", "PENDING_LEGAL_REVIEW", "USER_NOTIFICATION", "REGULATOR_NOTIFICATION", "PROVIDER_ESCALATION"]), reasonCode: z.string().trim().min(2).max(80), operationId: z.string().regex(/^INCOP-[A-Z0-9-]{12,80}$/) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SECURITY_INCIDENTS_RESOLVE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Incident notification decision validation failed."); try { return ok({ data: await recordIncidentNotificationDecision({ actorUserId: auth.user.id, publicReference: (await params).reference, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof SecurityIncidentError ? error.code : "SECURITY_INCIDENT_NOT_FOUND"); } }
