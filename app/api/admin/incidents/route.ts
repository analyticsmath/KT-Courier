import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { createOperationalIncident, listOperationalIncidents } from "@/lib/services/operational-incidents.service";

const incidentSchema = z.object({ severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), category: z.string().trim().min(2).max(80), safeSummary: z.string().trim().min(4).max(512), affectedCapabilities: z.array(z.string().trim().min(1).max(80)).max(20).optional(), detectionSource: z.string().trim().max(80).optional() }).strict();

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.INCIDENTS_READ, { request });
  if (auth.response) return auth.response;
  return ok({ data: await listOperationalIncidents() });
}

export async function POST(request: NextRequest) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;
  const auth = await requireAdminApiPermission(PERMISSIONS.INCIDENTS_MANAGE, { request });
  if (auth.response) return auth.response;
  if (Number(request.headers.get("content-length") ?? "0") > 4_096) return badRequest("Request body is too large.");
  const parsed = incidentSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return unprocessable("Operational incident request is invalid.");
  return created({ data: await createOperationalIncident({ actorUserId: auth.user.id, ...parsed.data }) });
}
