/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead } from "@/lib/promoters/api-policy";
import { db, promoterJson, safeRows } from "@/lib/promoters/route-support";
export async function GET(request: NextRequest) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_PERFORMANCE_READ_OWN, request, "/api/promoter/history"); if ("response" in auth) return auth.response; const [evaluations, edges, earnings] = await Promise.all([db.promoterQualificationEvaluation.findMany({ where: { promoterAccountId: auth.account.id }, orderBy: { evaluatedAt: "desc" }, take: 100 }), db.promoterTeamEdge.findMany({ where: { OR: [{ parentPromoterAccountId: auth.account.id }, { childPromoterAccountId: auth.account.id }] }, orderBy: { createdAt: "desc" }, take: 100 }), db.promoterEarning.findMany({ where: { promoterAccountId: auth.account.id }, orderBy: { createdAt: "desc" }, take: 100 })]); return promoterJson({ history: { evaluations: safeRows(evaluations as any), teamEdges: safeRows(edges as any), earnings: safeRows(earnings as any) } }); }
