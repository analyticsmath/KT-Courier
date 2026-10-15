import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prepareCommissionMutation } from "@/lib/commissions/admin-mutation-route";
import { commissionNoStoreJson } from "@/lib/commissions/api-policy";
import { getEarningClearancePolicy, getPendingEarningClearancePolicy, submitEarningClearancePolicy, reviewEarningClearancePolicy } from "@/lib/services/earning-clearance-policy.service";
import { ClearancePolicyDraftSchema } from "@/lib/earnings/clearance-policy";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_READ, { request });
  if (auth.response) return auth.response;
  try { return commissionNoStoreJson({ active: await getEarningClearancePolicy(), pending: await getPendingEarningClearancePolicy() }); }
  catch { return commissionNoStoreJson({ error: "Clearance policy is temporarily unavailable." }, 503); }
}

async function mutate(request: NextRequest, review: boolean) {
  const auth = await requireAdminApiPermission(PERMISSIONS.COMMISSION_PLANS_MANAGE, { request });
  if (auth.response) return auth.response;
  const payload = await prepareCommissionMutation(request, auth.user.id, "/api/admin/earning-clearance-policy", "plan");
  if ("response" in payload) return payload.response;
  const parsed = (review ? z.object({ version: z.string().min(1).max(80), reviewed: z.literal(true) }).strict() : ClearancePolicyDraftSchema).safeParse(payload.body);
  if (!parsed.success) return commissionNoStoreJson({ error: "Invalid earning clearance policy." }, 422);
  try {
    const policy = review ? await reviewEarningClearancePolicy(auth.user.id, parsed.data.version) : await submitEarningClearancePolicy(auth.user.id, parsed.data);
    return commissionNoStoreJson({ policy }, review ? 200 : 201);
  } catch { return commissionNoStoreJson({ error: "Policy could not be saved. Use a new version, resolve pending review, and have a different administrator approve it." }, 409); }
}
export const POST = (request: NextRequest) => mutate(request, false);
export const PUT = (request: NextRequest) => mutate(request, true);
