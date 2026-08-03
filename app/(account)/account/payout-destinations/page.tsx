import { EditorialTable, OperationalPanel } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { requireAuth } from "@/lib/auth/guards";
import { listOwnerPayoutDestinations } from "@/lib/services/withdrawal-query.service";

export default async function PayoutDestinationsPage() {
  const user = await requireAuth();
  const destinations = await listOwnerPayoutDestinations(user.id);
  const rows = destinations.map((destination) => ({ ...destination, id: destination.publicReference }));
  return <CustomerPage eyebrow="Customer funds" title="Payout destinations" description="Read-only approved and masked payout destination references." actions={<CustomerAction href="/account/withdrawals">Back to withdrawals</CustomerAction>}><OperationalPanel title="Approved destinations" description="Bank-account numbers are never shown or collected here."><EditorialTable caption="Approved payout destinations" mobileMode="stack" rows={rows} emptyState={<p className="eo-table-empty" role="status">No active payout destinations are available.</p>} columns={[{ id: "reference", header: "Reference", cell: (destination) => destination.publicReference }, { id: "destination", header: "Destination", cell: (destination) => destination.maskedLabel }, { id: "institution", header: "Institution", cell: (destination) => destination.institutionName ?? "—" }, { id: "last-four", header: "Last four", cell: (destination) => destination.accountLast4 ?? "—" }]} /></OperationalPanel></CustomerPage>;
}
