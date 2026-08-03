import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { marketplaceError, marketplaceJson } from "@/lib/marketplace-checkout/api-policy";
import { prepareMarketplaceAdminRecovery } from "@/lib/marketplace-checkout/admin-recovery-policy";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "@/lib/marketplace-checkout/settlement.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE, { request }); if (auth.response) return auth.response;
  const prepared = await prepareMarketplaceAdminRecovery(request, { actorUserId: auth.user.id, permission: PERMISSIONS.MARKETPLACE_SETTLEMENT_RECONCILE, path: request.nextUrl.pathname }); if ("response" in prepared) return prepared.response;
  try { const { reference } = await context.params; const result = await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: reference, operationId: prepared.operationId }, createPrismaMarketplaceSettlementRepository()); return marketplaceJson({ settlement: result }); }
  catch (error) { return marketplaceError(error); }
}
