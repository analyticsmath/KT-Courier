/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead, safePromoterRow } from "@/lib/promoters/api-policy";
import { db, promoterJson } from "@/lib/promoters/route-support";
export async function GET(request: NextRequest) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_PERFORMANCE_READ_OWN, request, "/api/promoter/rank"); if ("response" in auth) return auth.response; const evaluation = await db.promoterQualificationEvaluation.findFirst({ where: { promoterAccountId: auth.account.id }, include: { rankDefinition: true, programVersion: { select: { publicReference: true } } }, orderBy: [{ periodKey: "desc" }, { evaluatedAt: "desc" }] }); return promoterJson({ rank: evaluation ? safePromoterRow(evaluation as any) : null }); }
