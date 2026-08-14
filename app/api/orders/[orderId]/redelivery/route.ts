import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, created, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { requestRedelivery, ShippingGovernanceError } from "@/lib/services/shipping-governance.service";
const schema = z.object({ operationId: z.string().regex(/^REDOP-[A-Z0-9-]{12,80}$/), safeNote: z.string().trim().max(240).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const user = await getCurrentUser(); if (!user) return unauthorized(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Redelivery request validation failed."); try { return created({ data: await requestRedelivery({ orderId: (await params).orderId, requesterUserId: user.id, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ShippingGovernanceError ? error.code : "REDELIVERY_REQUEST_FAILED"); } }
