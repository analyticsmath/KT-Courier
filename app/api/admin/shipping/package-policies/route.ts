import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { badRequest, created, ok, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { createPackagePolicyVersion, listEffectivePackagePolicies, ShippingObligationError } from "@/lib/services/shipping-obligations.service";

const schema = z.object({ stableKey: z.string().regex(/^[A-Z][A-Z0-9_]{2,80}$/), versionNumber: z.number().int().positive(), effectiveFrom: z.string().datetime(), effectiveTo: z.string().datetime().optional(), prohibitedClassifications: z.array(z.string().trim().min(1).max(80)).max(100).optional(), fragileHandlingRequired: z.boolean().optional(), highValueDeclarationRequired: z.boolean().optional(), declaredValueMinimum: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), declaredValueMaximum: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), insuranceMode: z.enum(["AVAILABLE", "UNAVAILABLE", "CLIENT_VALUE_REQUIRED"]), insuranceCoverageLimit: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(), packagingRequirements: z.record(z.string(), z.unknown()).optional() }).strict();

export async function GET(request: NextRequest) { const auth = await requireAdminApiPermission(PERMISSIONS.SHIPPING_PACKAGE_POLICIES_READ, { request }); if (auth.response) return auth.response; return ok({ data: await listEffectivePackagePolicies() }); }
export async function POST(request: NextRequest) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const auth = await requireAdminApiPermission(PERMISSIONS.SHIPPING_PACKAGE_POLICIES_MANAGE, { request }); if (auth.response) return auth.response; const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Package policy validation failed."); try { return created({ data: await createPackagePolicyVersion({ actorUserId: auth.user.id, ...parsed.data, effectiveFrom: new Date(parsed.data.effectiveFrom), effectiveTo: parsed.data.effectiveTo ? new Date(parsed.data.effectiveTo) : undefined }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "PACKAGE_POLICY_CREATE_FAILED"); } }
