import { UserRole } from "@/types/db";
import { resolveWithdrawalOwnerForUser } from "@/lib/withdrawals/withdrawal-owner-policy";
import { prisma } from "@/lib/db/prisma";
import { WithdrawalError } from "@/lib/withdrawals/errors";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { EditorialTable, OperationalPanel } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { requireRole } from "@/lib/auth/guards";
import { listOwnerPayoutDestinations } from "@/lib/services/withdrawal-query.service";

export default async function PayoutDestinationsPage({ ownerRole, basePath }: { ownerRole: typeof UserRole.STORE | typeof UserRole.DRIVER; basePath: "/store/withdrawals" | "/driver/withdrawals" }) {
  const user = await requireRole(ownerRole);
  try { await resolveWithdrawalOwnerForUser(prisma, user.id); } catch (error) {
    if (error instanceof WithdrawalError && error.code === "WITHDRAWAL_OWNER_INELIGIBLE") return <ProtectedState kind="unavailable" title="Withdrawals are unavailable" description="An active eligible owner account is required. This page does not approve payout access." />;
    throw error;
  }
  const destinations = await listOwnerPayoutDestinations(user.id);
  const rows = destinations.map((destination) => ({ ...destination, id: destination.publicReference }));
  return <CustomerPage eyebrow="Owner funds" title="Payout destinations" description="Read-only approved and masked payout destination references." actions={<CustomerAction href={basePath}>Back to withdrawals</CustomerAction>}><OperationalPanel title="Approved destinations" description="Bank-account numbers are never shown or collected here."><EditorialTable caption="Approved payout destinations" mobileMode="stack" rows={rows} emptyState={<p className="eo-table-empty" role="status">No active payout destinations are available.</p>} columns={[{ id: "reference", header: "Reference", cell: (destination) => destination.publicReference }, { id: "destination", header: "Destination", cell: (destination) => destination.maskedLabel }, { id: "institution", header: "Institution", cell: (destination) => destination.institutionName ?? "—" }, { id: "last-four", header: "Last four", cell: (destination) => destination.accountLast4 ?? "—" }]} /></OperationalPanel></CustomerPage>;
}
