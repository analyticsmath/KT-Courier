import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StoreSubscriptionBenefitsPage() {
  await requireBusinessPage("/store/subscription/benefits");
  return <StoreCommercialUnavailablePage eyebrow="Membership" title="Store membership benefits" description="Benefit tracking requires a source-backed entitlement projection." stateTitle="Store membership benefits are not currently available" stateDescription="No quota, delivery reduction, priority handling, or eligibility is invented for this store." backHref="/store/subscription" backLabel="Back to membership" />;
}
