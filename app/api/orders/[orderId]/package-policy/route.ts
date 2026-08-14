import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { badRequest, created, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { acceptShipmentPackagePolicy, ShippingObligationError } from "@/lib/services/shipping-obligations.service";
const schema = z.object({ operationId: z.string().regex(/^PKGOP-[A-Z0-9-]{12,100}$/), policyStableKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/), declaredValue: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), currency: z.string().trim().length(3).optional(), classification: z.string().trim().max(80).optional(), fragile: z.boolean().optional(), highValue: z.boolean().optional(), packagingConfirmed: z.literal(true), insuranceRequested: z.boolean().optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const user = await getCurrentUser(); if (!user) return unauthorized(); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Package declaration validation failed."); try { return created({ data: await acceptShipmentPackagePolicy({ orderId: (await params).orderId, actorUserId: user.id, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "PACKAGE_DECLARATION_FAILED"); } }
