/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterMutation, requirePromoterRead, promoterJson, safePromoterRow } from "@/lib/promoters/api-policy";
import { createPromoterDispute } from "@/lib/promoters/promoter-dispute.service";
import { isRouteResponse, parsePromoterCommand } from "@/lib/promoters/route-support";

const disputeSchema = z.object({ operationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/), category: z.enum(["MISSING_ATTRIBUTION", "MISSING_QUALIFICATION", "MISSING_EARNING", "DISPUTED_REVERSAL"]), promoterStatement: z.string().trim().min(10).max(2_000), attributionId: z.string().optional(), earningId: z.string().optional(), safeEvidenceReference: z.string().regex(/^[A-Za-z0-9._:-]{6,160}$/).optional() }).strict();

export async function GET(request: NextRequest) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN, request, "/api/promoter/disputes"); if ("response" in auth) return auth.response; const rows = await (prisma as any).promoterDispute.findMany({ where: { promoterAccountId: auth.account.id }, orderBy: { createdAt: "desc" } }); return promoterJson({ disputes: rows.map(safePromoterRow) }); }
export async function POST(request: NextRequest) { const auth = await requirePromoterMutation(request, PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN, "/api/promoter/disputes"); if ("response" in auth) return auth.response; const body = await parsePromoterCommand(request, disputeSchema); if (isRouteResponse(body)) return body; try { const row = await createPromoterDispute(prisma as any, { ...body, promoterAccountId: auth.account.id, actorUserId: auth.user.id }); return promoterJson({ dispute: safePromoterRow(row) }, 201); } catch { return promoterJson({ error: "Dispute request was rejected." }, 422); } }
