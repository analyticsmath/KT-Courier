import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { CommissionPlanDraftForm } from "@/components/admin/CommissionPlanDraftForm";
import { OwnerCommissionDefaultPreparation } from "@/components/admin/OwnerCommissionDefaultPreparation";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/current-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listCommissionPlans } from "@/lib/services/commission-plan-query.service";
import { prisma } from "@/lib/db/prisma";
import { QaSettlementRecoveryPanel } from "@/components/admin/QaSettlementRecoveryPanel";
import { listAllQaSettlementRecoveries } from "@/lib/qa-acceptance/settlement-recovery";
import { diagnoseDriverSettlementReadiness } from "@/lib/services/driver-settlement-producer.service";

export default async function CommissionPlansPage({ searchParams }: { searchParams: Promise<{ storeId?: string }> }) {
  await requireAdminPagePermission(PERMISSIONS.COMMISSION_PLANS_READ);
  const user = await getCurrentUser();
  const [plans, canManage, canApprove, canFinanceRead, qaDeliveredOrders, qaPlans, qaRecoveries] = await Promise.all([
    listCommissionPlans({ page: 1, pageSize: 50 }),
    user ? hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMISSION_PLANS_MANAGE }) : Promise.resolve(false),
    user ? hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.COMMISSION_PLANS_APPROVE }) : Promise.resolve(false),
    user ? hasPermission({ userId: user.id, role: user.role, permissionKey: PERMISSIONS.FINANCE_READ }) : Promise.resolve(false),
    prisma.order.findMany({
      where: { isQaAcceptance: true, status: { in: ["DELIVERED", "COMPLETED"] } },
      orderBy: [{ createdAt: "desc" }],
      take: 25,
      select: { id: true, orderNumber: true, priceEstimate: true, pricingQuote: { select: { total: true } } },
    }),
    prisma.commissionPlan.findMany({
      where: { subjectType: "COURIER_ORDER", scopeKey: { in: ["GLOBAL:COURIER_ORDER", "QA:COURIER_ORDER"] }, status: "ACTIVE" },
      select: { publicReference: true, scopeKey: true, versionNumber: true },
    }),
    listAllQaSettlementRecoveries(),
  ]);
  const stores = canManage ? await prisma.store.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: [{ name: "asc" }, { id: "asc" }] }) : [];
  const requestedStoreId = (await searchParams).storeId;
  const selectedStoreId = requestedStoreId && stores.some(store => store.id === requestedStoreId) ? requestedStoreId : undefined;
  const recoveryByOrder = new Map(qaRecoveries.map((r) => [r.orderId, r]));
  const qaRecoveryItems = canFinanceRead
    ? await Promise.all(
        qaDeliveredOrders.map(async (ord) => {
          const amount = ord.pricingQuote?.total ?? ord.priceEstimate;
          return {
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            totalAmountZar: amount ? amount.toFixed(2) : "0.00",
            diagnostic: await diagnoseDriverSettlementReadiness(ord.id).catch(() => null),
            recovery: recoveryByOrder.get(ord.id) ?? null,
          };
        }),
      )
    : [];
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Finance administration" title="Commission Plans" description="Versioned policy drafts, independent review, and immutable activated policy evidence." />{canManage ? <><OwnerCommissionDefaultPreparation /><CommissionPlanDraftForm stores={stores} selectedStoreId={selectedStoreId} /></> : null}{canFinanceRead ? <QaSettlementRecoveryPanel initialItems={qaRecoveryItems} initialPlans={qaPlans} canManage={canManage} canApprove={canApprove} /> : null}<AdministrationPanel>{plans.data.length ? <table className="w-full text-left text-sm" aria-label="commission-plans-table"><thead><tr><th>Reference</th><th>Status</th><th>Version</th><th>Scope</th><th>Basis</th><th>Effective period</th></tr></thead><tbody>{plans.data.map((plan) => <tr key={plan.id}><td><Link href={`/admin/commission-plans/${plan.id}`}>{plan.publicReference}</Link></td><td>{plan.status}</td><td>{plan.versionNumber}</td><td>{plan.scopeKey}</td><td>{plan.basisType}</td><td>{plan.effectiveFrom} — {plan.effectiveUntil ?? "Open"}</td></tr>)}</tbody></table> : <p role="status">No commission plans are available.</p>}</AdministrationPanel></div>;
}
