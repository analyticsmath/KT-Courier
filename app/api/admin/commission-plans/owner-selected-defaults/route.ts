import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prepareOwnerSelectedCommissionDefaults } from "@/lib/commercial/owner-selected-commission-defaults";
import { commissionApiError, commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RequestSchema = z.object({ confirmed: z.literal(true) }).strict();

export async function POST(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_MANAGE, { request });
  if (auth.response) return auth.response;
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/commission-plans/owner-selected-defaults", "plan");
  if ("response" in payload) return payload.response;
  if (!RequestSchema.safeParse(payload.body).success) {
    return commissionNoStoreJson({ error: "Confirm preparation of the owner-approved commission drafts." }, 422);
  }
  try {
    return commissionNoStoreJson(await prepareOwnerSelectedCommissionDefaults(auth.user.id), 201);
  } catch (error) {
    return commissionApiError(error);
  }
}
