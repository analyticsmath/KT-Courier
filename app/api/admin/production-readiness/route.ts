import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getProductionReadiness } from "@/lib/production-readiness/service";
import { AcceptanceDraftSchema, AcceptanceReviewSchema, recordAcceptanceEvidence, reviewAcceptanceEvidence } from "@/lib/production-readiness/evidence";
import {
  QaFunctionalDraftInputSchema,
  QaFunctionalReviewSchema,
  recordQaFunctionalEvidence,
  reviewQaFunctionalEvidence,
} from "@/lib/production-readiness/qa-functional-evidence";
import { buildProductionVerificationOptions } from "@/lib/production-readiness/verification-adapters.server";
import { mutation, failure, json } from "@/lib/client-platform/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_READ, { request });
  if (auth.response) return auth.response;
  return Response.json(await getProductionReadiness(), { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
const stripKindField = (raw: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(raw).filter(([key]) => key !== "kind"));

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `acceptance-evidence:${auth.user.id}`); if ("response" in body) return body.response;
  const rawBody = body.body && typeof body.body === "object" ? (body.body as Record<string, unknown>) : null;
  if (rawBody?.kind === "QA_FUNCTIONAL") {
    const parsedQa = QaFunctionalDraftInputSchema.safeParse(stripKindField(rawBody));
    if (!parsedQa.success) {
      return json({ error: parsedQa.error.issues[0]?.message ?? "Invalid QA functional evidence." }, 422);
    }
    try {
      return json(await recordQaFunctionalEvidence(auth.user.id, parsedQa.data), 201);
    } catch (error) {
      return failure(error);
    }
  }
  const parsed = AcceptanceDraftSchema.safeParse(body.body); if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Invalid evidence." }, 422);
  try { return json(await recordAcceptanceEvidence(auth.user.id, parsed.data, buildProductionVerificationOptions()), 201); } catch (error) { return failure(error); }
}
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.SYSTEM_READINESS_MANAGE, { request });
  if (auth.response) return auth.response;
  const body = await mutation(request, `acceptance-review:${auth.user.id}`); if ("response" in body) return body.response;
  const rawBody = body.body && typeof body.body === "object" ? (body.body as Record<string, unknown>) : null;
  if (rawBody?.kind === "QA_FUNCTIONAL") {
    const parsedQa = QaFunctionalReviewSchema.safeParse(stripKindField(rawBody));
    if (!parsedQa.success) {
      return json({ error: parsedQa.error.issues[0]?.message ?? "Invalid QA functional review." }, 422);
    }
    try {
      return json(await reviewQaFunctionalEvidence(auth.user.id, parsedQa.data));
    } catch (error) {
      return failure(error);
    }
  }
  const parsed = AcceptanceReviewSchema.safeParse(body.body); if (!parsed.success) return json({ error: "Invalid evidence review." }, 422);
  try { return json(await reviewAcceptanceEvidence(auth.user.id, parsed.data, buildProductionVerificationOptions())); } catch (error) { return failure(error); }
}
