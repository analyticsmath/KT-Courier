/* eslint-disable @typescript-eslint/no-explicit-any */
import { type NextRequest } from "next/server";
import { requireAdminApiPermission } from "@/lib/auth/admin-api";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { prisma } from "@/lib/db/prisma";
import { marketplaceError, marketplaceJson } from "@/lib/marketplace-checkout/api-policy";
import { prepareMarketplaceAdminRecovery } from "@/lib/marketplace-checkout/admin-recovery-policy";
import { onVerifiedMarketplacePaymentSucceededInProduction } from "@/lib/marketplace-checkout/marketplace-payment-success-hook.service";

export async function POST(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requireAdminApiPermission(PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE, { request }); if (auth.response) return auth.response;
  const prepared = await prepareMarketplaceAdminRecovery(request, { actorUserId: auth.user.id, permission: PERMISSIONS.MARKETPLACE_CHECKOUT_RECONCILE, path: request.nextUrl.pathname }); if ("response" in prepared) return prepared.response;
  try {
    const { reference } = await context.params;
    const payment = await (prisma as any).payment.findFirst({ where: { subjectType: "MARKETPLACE_CHECKOUT", status: "SUCCEEDED", marketplaceCheckout: { publicReference: reference } }, select: { id: true } });
    if (!payment) return marketplaceJson({ retry: "NOT_ELIGIBLE" }, 404);
    await onVerifiedMarketplacePaymentSucceededInProduction(payment.id);
    return marketplaceJson({ retry: "CANONICAL_FINALIZATION_SCHEDULED", operationId: prepared.operationId });
  } catch (error) { return marketplaceError(error); }
}
