import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { activatePackagePolicyVersion, ShippingObligationError } from "@/lib/services/shipping-obligations.service";
const paramsSchema = z.object({ stableKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/), version: z.coerce.number().int().positive() });
export async function POST(request: NextRequest, { params }: { params: Promise<{ stableKey: string; version: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SHIPPING_PACKAGE_POLICIES_MANAGE, { request }); if (auth.response) return auth.response; const parsed = paramsSchema.safeParse(await params); if (!parsed.success) return unprocessable("Package policy reference is invalid."); try { return ok({ data: await activatePackagePolicyVersion({ actorUserId: auth.user.id, stableKey: parsed.data.stableKey, versionNumber: parsed.data.version }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "PACKAGE_POLICY_ACTIVATION_FAILED"); } }
