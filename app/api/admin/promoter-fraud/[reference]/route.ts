/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterAdmin } from "@/lib/promoters/admin-api-policy";
export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_FRAUD_READ, "/api/admin/promoter-fraud/[reference]"); if ("response" in auth) return auth.response; const { reference } = await context.params; const row = await (prisma as any).promoterFraudCase.findUnique({ where: { publicReference: reference }, select: { publicReference: true, status: true, priority: true, reason: true, safeSummary: true, safeEvidence: true, openedAt: true, lastObservedAt: true, resolvedAt: true, resolutionCode: true } }); return row ? Response.json({ case: row }) : Response.json({ error: "Not found." }, { status: 404 }); }
