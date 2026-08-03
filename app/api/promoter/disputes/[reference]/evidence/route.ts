/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import type { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterMutation, promoterJson, safePromoterRow } from "@/lib/promoters/api-policy";
import { isRouteResponse, parsePromoterCommand } from "@/lib/promoters/route-support";
import { addPromoterDisputeEvidence } from "@/lib/promoters/promoter-dispute.service";
const evidenceSchema = z.object({ operationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/), attachmentReference: z.string().regex(/^[A-Za-z0-9._:-]{6,160}$/), contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]) }).strict();
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const auth = await requirePromoterMutation(request, PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN, "/api/promoter/disputes/[reference]/evidence"); if ("response" in auth) return auth.response; const body = await parsePromoterCommand(request, evidenceSchema); if (isRouteResponse(body)) return body; try { const { reference } = await context.params; return promoterJson({ dispute: safePromoterRow(await addPromoterDisputeEvidence(prisma as any, { ...body, reference, actorUserId: auth.user.id })) }); } catch { return promoterJson({ error: "Evidence was rejected." }, 422); } }
