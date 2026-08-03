/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterAdmin } from "@/lib/promoters/admin-api-policy";
export async function GET(request: NextRequest) { const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_FRAUD_READ, "/api/admin/promoter-fraud"); if ("response" in auth) return auth.response; const rows = await (prisma as any).promoterFraudCase.findMany({ orderBy: [{ priority: "desc" }, { lastObservedAt: "desc" }], select: { publicReference: true, status: true, priority: true, reason: true, safeSummary: true, openedAt: true, lastObservedAt: true } }); return Response.json({ cases: rows }); }
