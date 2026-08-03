/* eslint-disable @typescript-eslint/no-explicit-any -- Phase 25 delegates are generated during deferred validation. */
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requirePromoterRead, promoterJson, safePromoterRow } from "@/lib/promoters/api-policy";
export async function GET(_: Request, context: { params: Promise<{ reference: string }> }) { const auth = await requirePromoterRead(PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN); if ("response" in auth) return auth.response; const { reference } = await context.params; const row = await (prisma as any).promoterDispute.findFirst({ where: { publicReference: reference, promoterAccountId: auth.account.id } }); return row ? promoterJson({ dispute: safePromoterRow(row) }) : promoterJson({ error: "Not found." }, 404); }
