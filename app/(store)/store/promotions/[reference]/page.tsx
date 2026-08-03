import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StorePromotionDetailPage() {
  return <StoreCommercialUnavailablePage eyebrow="Promotions" title="Promotion details" description="Promotion detail records remain unavailable until the commercial capability is enabled." stateTitle="Promotion detail is not currently available" stateDescription="The route remains present, but it does not expose a fictional campaign, lifecycle, or performance record." backHref="/store/promotions" backLabel="Back to promotions" />;
}
