/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterAdmin } from "@/lib/promoters/admin-api-policy";
import { PromoterProgrammeConfigService } from "@/lib/promoters/programme-config.service";
import { db, isRouteResponse, operationSchema, parsePromoterCommand, promoterJson, safeRows } from "@/lib/promoters/route-support";

const rule = z.object({ code: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), type: z.enum(["DIRECT_REFERRAL_COUNT", "QUALIFIED_TARGET_COUNT", "MONTHLY_ACTIVITY_COUNT", "TEAM_MEMBER_COUNT", "TEAM_QUALIFIED_COUNT", "QUALIFYING_TRANSACTION_COUNT", "QUALIFYING_REVENUE_AMOUNT"]), configuration: z.record(z.string(), z.unknown()), required: z.boolean().optional() });
const rank = z.object({ code: z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/), displayName: z.string().trim().min(2).max(120), rankOrder: z.number().int().min(0).max(999), qualificationRuleCodes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)), benefitConfiguration: z.record(z.string(), z.unknown()).nullable().optional() });
const schema = z.object({ operationId: operationSchema, requestHash: z.string().length(64).optional(), attributionWindowDays: z.number().int().min(1).max(3650), qualifyingEventType: z.enum(["CUSTOMER_FIRST_COMPLETED_SETTLED_COURIER_ORDER", "CUSTOMER_FIRST_COMPLETED_SETTLED_MARKETPLACE_ORDER", "BUSINESS_FIRST_COMPLETED_SETTLED_ORDER", "STORE_FIRST_SETTLED_MARKETPLACE_ORDER", "DRIVER_FIRST_COMPLETED_SETTLED_DELIVERY"]), qualificationHoldDays: z.number().int().min(0).max(3650), commissionPlanVersionId: z.string().min(1).max(120), geographicPolicyVersion: z.string().min(1).max(120), fraudPolicyVersion: z.string().min(1).max(120), disclosurePolicyVersion: z.string().min(1).max(120), reversalPolicyVersion: z.string().min(1).max(120), legalTermsVersion: z.string().min(1).max(120), teamRules: z.record(z.string(), z.unknown()).nullable().optional(), bonusRules: z.record(z.string(), z.unknown()).nullable().optional(), startsAt: z.coerce.date(), endsAt: z.coerce.date().optional(), maximumQualificationsPerPromoter: z.number().int().positive().optional(), maximumQualificationsPerDay: z.number().int().positive().optional(), maximumQualificationsPerSubject: z.number().int().positive().optional(), qualificationRules: z.array(rule).min(1).max(100), rankDefinitions: z.array(rank).min(1).max(20) }).strict();

export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_PROGRAMS_REVIEW, "/api/admin/promoter-programs/[reference]/versions"); if ("response" in auth) return auth.response;
  const { reference } = await context.params; const programme = await db.promoterProgram.findUnique({ where: { publicReference: reference }, include: { versions: { include: { rankDefinitions: { orderBy: { rankOrder: "asc" } }, qualificationRules: { orderBy: { code: "asc" } } }, orderBy: { versionNumber: "desc" } } } });
  return programme ? promoterJson({ program: { ...programme, versions: safeRows(programme.versions as any) } }) : promoterJson({ error: "PROGRAM_NOT_FOUND" }, 404);
}

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_PROGRAMS_MANAGE, "/api/admin/promoter-programs/[reference]/versions", true); if ("response" in auth) return auth.response;
  const body = await parsePromoterCommand(request, schema); if (isRouteResponse(body)) return body; const { reference } = await context.params;
  try { return promoterJson({ version: await new PromoterProgrammeConfigService(db).createVersion({ ...body, programReference: reference, actorUserId: auth.user.id }) }, 201); } catch (error: any) { return promoterJson({ error: error.code ?? "PROMOTER_INVALID_COMMAND" }, 422); }
}
