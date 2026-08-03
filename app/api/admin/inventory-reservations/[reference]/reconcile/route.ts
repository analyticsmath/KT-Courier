import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { marketplaceError, marketplaceJson } from "@/lib/marketplace-checkout/api-policy";
import { prepareMarketplaceAdminRecovery } from "@/lib/marketplace-checkout/admin-recovery-policy";
import { reconcileMarketplaceReservation } from "@/lib/marketplace-checkout/reconciliation.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.INVENTORY_RESERVATIONS_RECONCILE, { request }); if (auth.response) return auth.response;
  const prepared = await prepareMarketplaceAdminRecovery(request, { actorUserId: auth.user.id, permission: PERMISSIONS.INVENTORY_RESERVATIONS_RECONCILE, path: request.nextUrl.pathname }); if ("response" in prepared) return prepared.response;
  try { const { reference } = await context.params; return marketplaceJson({ reconciliation: await reconcileMarketplaceReservation(reference, prepared.operationId) }); }
  catch (error) { return marketplaceError(error); }
}
