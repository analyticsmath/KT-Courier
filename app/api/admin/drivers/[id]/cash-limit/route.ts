import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { enforceSameOriginRequest } from "@/lib/security/request-origin";
import { updateDriverCashLimit } from "@/lib/services/driver-cash-capacity.service";
import { badRequest, conflict, notFound, ok, unprocessable } from "@/lib/api/response";

const CashLimitSchema = z.object({
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a valid nonnegative rand amount."),
  expectedRevision: z.number().int().nonnegative(),
}).strict();

/** Two independent finance/driver management permissions are required. */
export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const origin = await enforceSameOriginRequest(request);
  if (origin) return origin;
  const driverAccess = await requireAdminApiPermission(PERMISSIONS.DRIVERS_UPDATE, { request });
  if (driverAccess.response) return driverAccess.response;
  const financeAccess = await requireAdminApiPermission("cod_operations.manage", { request });
  if (financeAccess.response) return financeAccess.response;
  let body: unknown;
  try { body = await request.json(); } catch { return badRequest("Invalid JSON request."); }
  const parsed = CashLimitSchema.safeParse(body);
  if (!parsed.success) return unprocessable("Enter an approved cash limit and current revision.");
  try {
    const { id } = await context.params;
    const result = await updateDriverCashLimit(id, driverAccess.user.id, parsed.data.amount, parsed.data.expectedRevision);
    return result ? ok(result) : notFound("Driver not found.");
  } catch (error) {
    if (error instanceof Error && error.message.includes("changed by another administrator")) return conflict(error.message);
    return unprocessable(error instanceof Error ? error.message : "Cash limit was not saved.");
  }
}
