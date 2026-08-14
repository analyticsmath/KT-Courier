import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { scheduleRedelivery, ShippingGovernanceError } from "@/lib/services/shipping-governance.service";
const schema = z.object({ operationId: z.string().regex(/^REDOP-[A-Z0-9-]{12,80}$/), scheduledFor: z.string().datetime(), responsibilityCode: z.string().trim().min(2).max(80) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.DELIVERIES_REDELIVERY_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Redelivery schedule validation failed."); try { return ok({ data: await scheduleRedelivery({ actorUserId: auth.user.id, publicReference: (await params).reference, scheduledFor: new Date(parsed.data.scheduledFor), responsibilityCode: parsed.data.responsibilityCode, operationId: parsed.data.operationId }) }); } catch (error) { return badRequest(error instanceof ShippingGovernanceError ? error.code : "REDELIVERY_SCHEDULE_FAILED"); } }
