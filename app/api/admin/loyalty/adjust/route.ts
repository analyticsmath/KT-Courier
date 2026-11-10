import { type NextRequest } from "next/server";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { ok, badRequest, serverError, unprocessable } from "@/lib/api/response";
import { adjustCustomerLoyaltyPoints } from "@/lib/rewards/customer-loyalty-admin.service";

const AdjustLoyaltySchema = z.object({
  customerUserId: z.string().min(1),
  deltaPoints: z.string().regex(/^-?[1-9]\d*$/, "Delta points must be a nonzero integer string"),
  reason: z.string().min(5),
});

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.CUSTOMERS_UPDATE, { request });
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return unprocessable("Invalid JSON body.");
  }

  const parsed = AdjustLoyaltySchema.safeParse(body);
  if (!parsed.success) {
    return unprocessable(parsed.error.issues[0]?.message ?? "Invalid adjustment payload.");
  }

  try {
    const result = await adjustCustomerLoyaltyPoints({
      customerUserId: parsed.data.customerUserId,
      deltaPoints: BigInt(parsed.data.deltaPoints),
      reason: parsed.data.reason,
      actorUserId: auth.user.id,
    });
    const response = ok(result);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    if (error instanceof Error && (error.message.includes("required") || error.message.includes("nonzero"))) {
      return badRequest(error.message);
    }
    return serverError();
  }
}
