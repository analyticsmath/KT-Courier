import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StoreSubscriptionPlansPage() {
  await requireBusinessPage("/store/subscription/plans");
  return <StoreCommercialUnavailablePage eyebrow="Membership" title="Store membership plans" description="Plan selection is available only when the source-backed membership capability is available." stateTitle="Store membership plans are not currently available" stateDescription="No tier, price, benefit, platform fee, or upgrade action is displayed without a current authoritative projection." backHref="/store/subscription" backLabel="Back to membership" />;
}
