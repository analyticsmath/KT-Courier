import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, notFound, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { getOperationalIncident, transitionOperationalIncident } from "@/lib/services/operational-incidents.service";

const transitionSchema = z
  .object({
    nextStatus: z.enum(["INVESTIGATING", "MITIGATING", "MONITORING", "RESOLVED", "CLOSED"]),
    reasonCode: z.string().trim().min(2).max(80),
    note: z.string().trim().max(512).optional(),
    operationId: z.string().regex(/^INCOP-[A-Z0-9-]{12,80}$/),
    confirmStatus: z.string().trim().min(2).max(32),
  })
  .strict();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAdminApiPermission(PERMISSIONS.INCIDENTS_READ, { request });
  if (auth.response) return auth.response;

  const { reference } = await params;
  const incident = await getOperationalIncident(reference);
  if (!incident) return notFound("Operational incident not found.");
  return ok({ data: incident });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> },
) {
  const originFailure = await enforceSameOriginRequest(request);
  if (originFailure) return originFailure;

  const auth = await requireAdminApiPermission(PERMISSIONS.INCIDENTS_MANAGE, { request });
  if (auth.response) return auth.response;

  if (Number(request.headers.get("content-length") ?? "0") > 4_096) {
    return badRequest("Request body is too large.");
  }

  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.confirmStatus !== parsed.data.nextStatus) {
    return unprocessable("Incident transition confirmation is invalid.");
  }

  const { reference } = await params;
  try {
    return ok({ data: await transitionOperationalIncident({ actorUserId: auth.user.id, publicReference: reference, ...parsed.data }) });
  } catch {
    return badRequest("Operational incident transition could not be completed.");
  }
}
