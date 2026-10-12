import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
export default function WithdrawalsPage() {
  return <CustomerPage eyebrow="Account" title="Withdrawals" description="Withdrawal requests belong to eligible owner workspaces."><ProtectedState kind="unavailable" title="Owner withdrawal access required" description="Store and driver owners can inspect withdrawals from their own workspace. Customer wallet and refund records remain available in this account." /></CustomerPage>;
}
