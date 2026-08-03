/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { marketplaceError, marketplaceJson } from "@/lib/marketplace-checkout/api-policy";
import { prepareMarketplaceAdminRecovery } from "@/lib/marketplace-checkout/admin-recovery-policy";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";
import { createPrismaMarketplaceSettlementRepository } from "@/lib/marketplace-checkout/prisma-marketplace-settlement.repository";
import { settleMarketplaceStoreOrder } from "@/lib/marketplace-checkout/settlement.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE, { request }); if (auth.response) return auth.response;
  const prepared = await prepareMarketplaceAdminRecovery(request, { actorUserId: auth.user.id, permission: PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE, path: request.nextUrl.pathname }); if ("response" in prepared) return prepared.response;
  try {
    const { reference } = await context.params;
    const caseRow = await (prisma as any).marketplaceCheckoutReconciliationCase.findUnique({ where: { publicReference: reference }, include: { payment: true, marketplaceStoreOrder: true } });
    if (!caseRow) return marketplaceJson({ rescan: "NOT_FOUND" }, 404);
    if (caseRow.payment?.status === "SUCCEEDED" && !caseRow.marketplaceStoreOrder) await onVerifiedMarketplacePaymentSucceededInProduction(caseRow.payment.id);
    if (caseRow.marketplaceStoreOrder) await settleMarketplaceStoreOrder({ marketplaceStoreOrderReference: caseRow.marketplaceStoreOrder.publicReference, operationId: prepared.operationId }, createPrismaMarketplaceSettlementRepository());
    return marketplaceJson({ rescan: "CANONICAL_RETRY_REQUESTED", operationId: prepared.operationId });
  } catch (error) { return marketplaceError(error); }
}
