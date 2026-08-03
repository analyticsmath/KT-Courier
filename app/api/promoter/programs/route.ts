/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead } from "@/lib/promoters/api-policy";
import { db, promoterJson, safeRows } from "@/lib/promoters/route-support";
export async function GET(request: NextRequest) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_PROGRAMS_READ, request, "/api/promoter/programs"); if ("response" in auth) return auth.response; const programs = await db.promoterProgramVersion.findMany({ where: { status: "ACTIVE", program: { status: "ACTIVE" } }, include: { program: true, enrollments: { where: { promoterAccountId: auth.account.id }, select: { publicReference: true, status: true } } }, orderBy: { createdAt: "desc" } }); return promoterJson({ programs: safeRows(programs as any) }); }
