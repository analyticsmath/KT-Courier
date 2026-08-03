import { EditorialTable } from "@/components/protected-v2/data/EditorialTable";
import { OperationalPanel, MetricTile } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { ProtectedStatus } from "@/components/protected-v2/feedback/ProtectedStatus";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getFinanceDashboard } from "@/lib/services/finance-dashboard.service";
import { requireRefundPagePermission } from "@/lib/refunds/page-permission";
import { requireStoreEarningFinancePagePermission } from "@/lib/store-earnings/finance-permission";
import { requireDriverEarningFinancePagePermission } from "@/lib/driver-earnings/finance-permission";
import { presentR21Status } from "@/lib/admin-presentation/r21-status";

function Amount({ value }: { value: string }) {
  return <span className="font-mono tabular-nums">R {value}</span>;
}

function FinancialDefinitionList({ entries }: { entries: readonly { label: string; value: string | number }[] }) {
  return (
    <dl className="eo-detail-grid">
      {entries.map((entry) => <div key={entry.label}><dt>{entry.label}</dt><dd>{typeof entry.value === "string" ? <Amount value={entry.value} /> : entry.value}</dd></div>)}
    </dl>
  );
}

export default async function FinanceOverviewPage() {
  await requireAdminPagePermission(PERMISSIONS.FINANCE_DASHBOARD_READ);
  await requireRefundPagePermission(PERMISSIONS.FINANCE_REFUNDS_READ);
  await requireStoreEarningFinancePagePermission(PERMISSIONS.FINANCE_STORE_EARNINGS_READ);
  await requireDriverEarningFinancePagePermission(PERMISSIONS.FINANCE_DRIVER_EARNINGS_READ);
  const dashboard = await getFinanceDashboard();

  const driverRows = dashboard.driverEarnings.oldestUnreleasedEarnings.map((row: any) => ({ ...row, id: row.publicReference }));
  const refundRows = dashboard.refunds.oldestPending;
  const withdrawalRows = dashboard.oldestPending;

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Finance administration"
        title="Finance control ledger"
        description="Source-backed ZAR liabilities, reconciliation queues, and earning evidence. This page never posts, settles, or infers financial outcomes."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Cash-clearing balance" value={`R ${dashboard.cashClearingBalance}`} description="Ledger projection" />
        <MetricTile label="Withdrawal-held liability" value={`R ${dashboard.totalHeld}`} description="Funds remain held pending canonical workflow" />
        <MetricTile label="Open refund reconciliation" value={dashboard.refunds.openReconciliationCases} description="Requires authoritative evidence" />
        <MetricTile label="Open driver-earning reconciliation" value={dashboard.driverEarnings.reconciliationCount} description="No manual financial override" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OperationalPanel title="Driver earning positions" description="Distinct lifecycle balances from the canonical finance projection.">
          <FinancialDefinitionList entries={[
            { label: "Accrued", value: dashboard.driverEarnings.totalAccrued },
            { label: "Payable", value: dashboard.driverEarnings.payableBalance },
            { label: "Refund reserved", value: dashboard.driverEarnings.refundReserved },
            { label: "Refunded", value: dashboard.driverEarnings.refunded },
            { label: "Release eligible", value: dashboard.driverEarnings.releaseEligible },
            { label: "Released to owner-withdrawable", value: dashboard.driverEarnings.releasedToOwnerWithdrawable },
            { label: "Reversed", value: dashboard.driverEarnings.reversed },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Store earning positions" description="Canonical store-earning projections; payout execution is not implied.">
          <FinancialDefinitionList entries={[
            { label: "Accrued", value: dashboard.storeEarnings.totalAccrued },
            { label: "Payable", value: dashboard.storeEarnings.payableBalance },
            { label: "Refund reserved", value: dashboard.storeEarnings.refundReserved },
            { label: "Refunded", value: dashboard.storeEarnings.refunded },
            { label: "Release eligible", value: dashboard.storeEarnings.releaseEligible },
            { label: "Released to owner-withdrawable", value: dashboard.storeEarnings.releasedToWithdrawable },
            { label: "Reversed", value: dashboard.storeEarnings.reversed },
            { label: "Open reconciliation", value: dashboard.storeEarnings.reconciliationCount },
          ]} />
        </OperationalPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <OperationalPanel title="Oldest unreleased driver earnings" description="Ordered source records requiring the existing lifecycle evidence.">
          <EditorialTable caption="Oldest unreleased driver earnings" mobileMode="stack" rows={driverRows} columns={[
            { id: "reference", header: "Reference", cell: (row: any) => row.publicReference, priority: "primary" },
            { id: "assignment", header: "Assignment", cell: (row: any) => row.assignmentPublicReference, priority: "secondary" },
            { id: "amount", header: "Amount", align: "end", cell: (row: any) => <Amount value={row.amount} /> },
            { id: "accrued", header: "Accrued", cell: (row: any) => String(row.accruedAt), priority: "optional" },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Current-period driver totals" description="Recorded period totals, not a client-side calculation.">
          <EditorialTable caption="Current-period driver totals" mobileMode="stack" rows={dashboard.driverEarnings.driverTotalsByPeriod.drivers.map((row: any) => ({ ...row, id: row.driverPublicReference }))} columns={[
            { id: "driver", header: "Driver", cell: (row: any) => row.driverPublicReference, priority: "primary" },
            { id: "amount", header: "Amount", align: "end", cell: (row: any) => <Amount value={row.amount} /> },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Oldest pending refunds" description="Provider outcome and funding state remain authoritative elsewhere.">
          <EditorialTable caption="Oldest pending refunds" mobileMode="stack" rows={refundRows} columns={[
            { id: "reference", header: "Reference", cell: (row: any) => row.publicReference, priority: "primary" },
            { id: "amount", header: "Amount", align: "end", cell: (row: any) => <Amount value={row.amount} /> },
            { id: "method", header: "Method", cell: (row: any) => row.method, priority: "secondary" },
            { id: "status", header: "State", cell: (row: any) => { const status = presentR21Status(row.status); return <ProtectedStatus {...status} />; } },
          ]} />
        </OperationalPanel>
        <OperationalPanel title="Oldest pending withdrawals" description="Destination labels are safe projections; payout completion is never inferred.">
          <EditorialTable caption="Oldest pending withdrawals" mobileMode="stack" rows={withdrawalRows} columns={[
            { id: "reference", header: "Reference", cell: (row: any) => row.publicReference, priority: "primary" },
            { id: "owner", header: "Owner", cell: (row: any) => row.ownerType, priority: "secondary" },
            { id: "amount", header: "Amount", align: "end", cell: (row: any) => <Amount value={row.amount} /> },
            { id: "status", header: "State", cell: (row: any) => { const status = presentR21Status(row.status); return <ProtectedStatus {...status} />; } },
          ]} />
        </OperationalPanel>
      </div>

      <OperationalPanel title="Other canonical finance positions" description="These values are read-only evidence from the finance dashboard projection.">
        <FinancialDefinitionList entries={[
          { label: "Customer wallet liabilities", value: dashboard.refunds.walletLiabilities },
          { label: "Refund-held liabilities", value: dashboard.refunds.refundHeldLiabilities },
          { label: "Accrued platform commission", value: dashboard.commissions.accruedPlatformRevenue },
          { label: "Beneficiary commission payable", value: dashboard.commissions.beneficiaryPayable },
          { label: "Open commission reconciliation", value: dashboard.commissions.openReconciliationCases },
        ]} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
