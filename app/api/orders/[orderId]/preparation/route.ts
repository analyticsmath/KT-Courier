import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, ok, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { recordVendorPreparation, ShippingObligationError } from "@/lib/services/shipping-obligations.service";
const schema = z.object({ operationId: z.string().regex(/^PREPOP-[A-Z0-9-]{12,100}$/), eventType: z.enum(["PACKAGING_CONFIRMED", "LAWFUL_LISTING_CONFIRMED", "HANDOFF_READY"]), safeNote: z.string().trim().max(500).optional(), preparationDueAt: z.string().datetime().optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const user = await getCurrentUser(); if (!user) return unauthorized(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Preparation event validation failed."); try { return ok({ data: await recordVendorPreparation({ orderId: (await params).orderId, actorUserId: user.id, ...parsed.data, preparationDueAt: parsed.data.preparationDueAt ? new Date(parsed.data.preparationDueAt) : undefined }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "PREPARATION_EVENT_FAILED"); } }
