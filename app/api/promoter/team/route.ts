/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead } from "@/lib/promoters/api-policy";
import { PromoterTeamQualificationService } from "@/lib/promoters/team-qualification.service";
import { db, promoterJson } from "@/lib/promoters/route-support";
export async function GET(request: NextRequest) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_PERFORMANCE_READ_OWN, request, "/api/promoter/team"); if ("response" in auth) return auth.response; const versionReference = new URL(request.url).searchParams.get("version"); const version = versionReference ? await db.promoterProgramVersion.findFirst({ where: { publicReference: versionReference } }) : await db.promoterEnrollment.findFirst({ where: { promoterAccountId: auth.account.id, status: "ACTIVE" }, orderBy: { enrolledAt: "desc" }, include: { programVersion: true } }).then((row: any) => row?.programVersion); if (!version) return promoterJson({ team: { members: [], maxDepth: 0 } }); return promoterJson({ team: await new PromoterTeamQualificationService(db).team(version.id, auth.account.id, Number(new URL(request.url).searchParams.get("depth") ?? 6)) }); }
