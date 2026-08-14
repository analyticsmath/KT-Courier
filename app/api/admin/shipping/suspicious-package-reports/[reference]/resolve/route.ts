import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { resolveSuspiciousPackageReport, ShippingObligationError } from "@/lib/services/shipping-obligations.service";
const schema = z.object({ operationId: z.string().regex(/^DRRRES-[A-Z0-9-]{12,100}$/), safeResolution: z.string().trim().min(3).max(500) }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ reference: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SHIPPING_SUSPICIOUS_PACKAGE_REVIEW, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Suspicious package resolution validation failed."); try { return ok({ data: await resolveSuspiciousPackageReport({ publicReference: (await params).reference, actorUserId: auth.user.id, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "SUSPICIOUS_PACKAGE_RESOLUTION_FAILED"); } }
