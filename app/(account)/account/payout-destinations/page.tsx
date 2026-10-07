import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
export default function PayoutDestinationsPage() {
  return <CustomerPage eyebrow="Account" title="Payout destinations" description="Payout references belong to eligible owner workspaces."><ProtectedState kind="unavailable" title="Owner payout access required" description="Store and driver owners can inspect masked payout destinations from their own workspace." /></CustomerPage>;
}
