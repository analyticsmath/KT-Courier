import { type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverProfileIdForUser } from "@/lib/services/driver-assignments.service";
import { badRequest, created, forbidden, unauthorized, unprocessable } from "@/lib/api/response";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { UserRole } from "@/types/db";
import { recordDriverDeliveryResponsibility, ShippingObligationError } from "@/lib/services/shipping-obligations.service";
const schema = z.object({ operationId: z.string().regex(/^DRROP-[A-Z0-9-]{12,100}$/), assignmentVersion: z.number().int().nonnegative(), reportType: z.enum(["SAFETY_CHECK", "LAWFUL_TRANSPORT_CONFIRMATION", "SUSPICIOUS_PACKAGE"]), safeNote: z.string().trim().max(500).optional(), evidenceReference: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/).optional() }).strict();
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) { const origin = await enforceSameOriginRequest(request); if (origin) return origin; const user = await getCurrentUser(); if (!user) return unauthorized(); if (user.role !== UserRole.DRIVER) return forbidden(); const driverProfileId = await getDriverProfileIdForUser(user.id); if (!driverProfileId) return forbidden("Driver profile not found."); const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return unprocessable("Driver responsibility validation failed."); try { return created({ data: await recordDriverDeliveryResponsibility({ assignmentId: (await params).id, driverProfileId, driverUserId: user.id, ...parsed.data }) }); } catch (error) { return badRequest(error instanceof ShippingObligationError ? error.code : "DRIVER_RESPONSIBILITY_REPORT_FAILED"); } }
