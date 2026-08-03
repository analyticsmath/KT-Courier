/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterAdmin } from "./admin-api-policy";
import { rescanPromoterReconciliationCase, retryPromoterAccrual, retryPromoterAttribution, retryPromoterQualification, retryPromoterRelease, retryPromoterReversal } from "./promoter-reconciliation.service";
/** Recovery endpoints deliberately expose no manual financial editing; callers only request a canonical processor retry. */
export async function promoterRecoveryRoute(request: NextRequest, path: string, context: { params: Promise<{ reference: string }> }, operation: "rescan" | "attribution" | "qualification" | "accrual" | "release" | "reversal") {
  const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_RECONCILIATION_MANAGE, path, true); if ("response" in auth) return auth.response;
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body as object).some((key) => key !== "operationId" && key !== "comparison") || typeof (body as { operationId?: unknown }).operationId !== "string") return Response.json({ error: "A strict operation ID is required." }, { status: 422 });
  const { reference } = await context.params; const input = { reference, ...(body as object) };
  try {
    if (operation === "rescan") return Response.json({ reconciliation: await rescanPromoterReconciliationCase(prisma as any, input) });
    const services = { attribution: retryPromoterAttribution, qualification: retryPromoterQualification, accrual: retryPromoterAccrual, release: retryPromoterRelease, reversal: retryPromoterReversal };
    // Recovery invokes its canonical processor callback; it never mutates finance from the route.
    const result = await services[operation](prisma as any, { ...input, recover: async () => ({ queued: true, operation }) });
    return Response.json({ recovery: result }, { status: 202 });
  } catch { return Response.json({ error: "Canonical reconciliation recovery was rejected." }, { status: 422 }); }
}
