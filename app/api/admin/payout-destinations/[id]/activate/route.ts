import type { NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { transitionPayoutDestination } from "@/lib/services/payout-destination.service";
import { preparePayoutDestinationMutation } from "@/lib/withdrawals/payout-destination-admin-route";
import { withdrawalApiError, withdrawalNoStoreJson } from "@/lib/withdrawals/api-policy";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.PAYOUT_DESTINATIONS_MANAGE, { request }); if (auth.response) return auth.response;
  const prepared = await preparePayoutDestinationMutation(request, params, "/api/admin/payout-destinations/[id]/activate", auth.user.id); if ("response" in prepared) return prepared.response;
  try { const destination = await transitionPayoutDestination({ actorUserId: auth.user.id, publicReference: prepared.publicReference, action: "ACTIVATE" }); return withdrawalNoStoreJson({ payoutDestination: { publicReference: destination.publicReference, status: destination.status } }); }
  catch (error) { return withdrawalApiError(error); }
}
