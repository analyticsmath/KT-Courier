import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { AcceptanceDraftSchema, AcceptanceReviewSchema, recordAcceptanceEvidence, reviewAcceptanceEvidence } from "@/lib/production-readiness/evidence";
import { mutation, failure, json } from "@/lib/client-platform/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_READ, { request });
  if (auth.response) return auth.response;
  return Response.json(await getProductionReadiness(), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `acceptance-evidence:${auth.user.id}`); if ("response" in body) return body.response;
  const parsed = AcceptanceDraftSchema.safeParse(body.body); if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid evidence." }, 422);
  try { return json(await recordAcceptanceEvidence(auth.user.id, parsed.data), 201); } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `acceptance-review:${auth.user.id}`); if ("response" in body) return body.response;
  const parsed = AcceptanceReviewSchema.safeParse(body.body); if (!parsed.success) return json({ error: "Invalid evidence review." }, 422);
  try { return json(await reviewAcceptanceEvidence(auth.user.id, parsed.data)); } catch (error) { return failure(error); }
}
