import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StoreNewPromotionPage() {
  await requireBusinessPage("/store/promotions/new");
  return <StoreCommercialUnavailablePage eyebrow="Promotions" title="New promotion" description="Promotion creation retains its existing production controls." stateTitle="Promotion creation is not currently available" stateDescription="No promotion draft, discount, audience, budget, or review action can be created from this route." backHref="/store/promotions" backLabel="Back to promotions" />;
}
