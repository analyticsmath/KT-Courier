import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StorePromotionRedemptionsPage() {
  return <StoreCommercialUnavailablePage eyebrow="Promotions" title="Promotion redemptions" description="Promotion redemption data is not loaded until it has a source-backed store projection." stateTitle="Promotion redemptions are not currently available" stateDescription="No customer, coupon, redemption, or settlement data is fabricated for this route." backHref="/store/promotions" backLabel="Back to promotions" />;
}
