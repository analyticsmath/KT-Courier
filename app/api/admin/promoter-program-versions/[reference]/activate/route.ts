/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextRequest } from "next/server";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterAdmin } from "@/lib/promoters/admin-api-policy";
import { PromoterProgrammeConfigService } from "@/lib/promoters/programme-config.service";
import { db, isRouteResponse, operationSchema, parsePromoterCommand, promoterJson } from "@/lib/promoters/route-support";
import { z } from "zod";
const schema = z.object({ operationId: operationSchema }).strict();
export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) { const auth = await requirePromoterAdmin(request, PERMISSIONS.PROMOTER_PROGRAMS_ACTIVATE, "/api/admin/promoter-program-versions/[reference]/activate", true); if ("response" in auth) return auth.response; const body = await parsePromoterCommand(request, schema); if (isRouteResponse(body)) return body; const { reference } = await context.params; try { return promoterJson({ version: await new PromoterProgrammeConfigService(db).activateVersion({ ...body, versionReference: reference, actorUserId: auth.user.id }) }); } catch (error: any) { return promoterJson({ error: error.code ?? "PROMOTER_INVALID_COMMAND" }, 422); } }
