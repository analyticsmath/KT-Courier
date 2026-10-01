import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StoreSubscriptionPage() {
  await requireBusinessPage("/store/subscription");
  return <StoreCommercialUnavailablePage title="Store membership" description="Membership, billing, and entitlements retain their existing production controls." stateTitle="Store membership management is not currently available" stateDescription="No plan, recurring charge, entitlement, invoice, or payment authority is inferred by this route." />;
}
