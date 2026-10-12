import { UserRole } from "@/types/db";
import { resolveWithdrawalOwnerForUser } from "@/lib/withdrawals/withdrawal-owner-policy";
import { prisma } from "@/lib/db/prisma";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import Link from "next/link";
import { EditorialTable, MetricTile, OperationalPanel, ProtectedPagination, ProtectedStatus } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney, getCustomerWithdrawalStatus } from "@/lib/customer-presentation/customer-order-presentation";
import { WithdrawalRequestForm } from "@/components/withdrawals/WithdrawalRequestForm";
import { requireRole } from "@/lib/auth/guards";
import { getOwnerWithdrawalOverview, listOwnerWithdrawals } from "@/lib/services/withdrawal-query.service";
import { withdrawalProductionReadiness } from "@/lib/withdrawals/withdrawal-production-readiness";

const PAGE_SIZE = 20;

export default async function WithdrawalsPage({ searchParams, ownerRole, basePath }: { searchParams: Promise<{ page?: string }>; ownerRole: typeof UserRole.STORE | typeof UserRole.DRIVER; basePath: "/store/withdrawals" | "/driver/withdrawals" }) {
  const user = await requireRole(ownerRole);
  try { await resolveWithdrawalOwnerForUser(prisma, user.id); } catch (error) {
    if (error instanceof WithdrawalError && error.code === "WITHDRAWAL_OWNER_INELIGIBLE") return <ProtectedState kind="unavailable" title="Withdrawals are unavailable" description="An active eligible owner account is required. This page does not approve payout access." />;
    throw error;
  }
  const query = await searchParams;
  const pageValue = Number(query.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const [overview, withdrawals] = await Promise.all([getOwnerWithdrawalOverview(user.id), listOwnerWithdrawals(user.id, { page, pageSize: PAGE_SIZE })]);
  const readiness = withdrawalProductionReadiness();
  const disabledReason = !readiness.productionActive ? "New production withdrawal requests are inactive pending consolidated validation approval." : overview.destinations.length === 0 ? "No active payout destination is available. Contact finance administration." : null;
  const rows = withdrawals.data.map((withdrawal) => ({ ...withdrawal, id: withdrawal.publicReference }));
  return (
    <CustomerPage eyebrow="Owner funds" title="Withdrawals" description="Request eligible ZAR withdrawals to an approved, masked payout destination." actions={<CustomerAction href={basePath + "/destinations"}>Payout destinations</CustomerAction>}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><MetricTile label="Withdrawable balance" value={formatCustomerMoney(overview.withdrawableBalance, "ZAR")} /><MetricTile label="Reserved for withdrawal" value={formatCustomerMoney(overview.heldBalance, "ZAR")} /></div>
      <OperationalPanel title="Request withdrawal" description={disabledReason ? "Withdrawal requests remain locked in the current production state." : "Submit a request to an approved payout destination."}><WithdrawalRequestForm destinations={overview.destinations} disabledReason={disabledReason} /></OperationalPanel>
      <OperationalPanel title="Withdrawal history"><EditorialTable caption="Your withdrawal requests" mobileMode="stack" rows={rows} emptyState={<p className="eo-table-empty" role="status">No withdrawal requests yet.</p>} columns={[{ id: "reference", header: "Reference", cell: (withdrawal) => <Link className="font-mono font-semibold text-[var(--eo-operational)] hover:underline" href={`${basePath}/${withdrawal.publicReference}`}>{withdrawal.publicReference}</Link> }, { id: "amount", header: "Amount", align: "end", cell: (withdrawal) => formatCustomerMoney(withdrawal.amount, "ZAR") }, { id: "status", header: "Status", cell: (withdrawal) => { const status = getCustomerWithdrawalStatus(withdrawal.status); return <ProtectedStatus label={status.label} tone={status.tone} />; } }, { id: "destination", header: "Destination", cell: (withdrawal) => withdrawal.destination.maskedLabel }, { id: "requested", header: "Requested", cell: (withdrawal) => formatCustomerDateTime(withdrawal.requestedAt) ?? "—" }]} /></OperationalPanel>
      <ProtectedPagination currentPage={page} pageCount={withdrawals.pagination.totalPages} hrefForPage={(nextPage) => `${basePath}?page=${nextPage}`} />
    </CustomerPage>
  );
}
