import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default async function StorePromotionBudgetPage() {
  await requireBusinessPage("/store/promotions/[reference]/budget");
  return (
    <StoreCommercialUnavailablePage
      eyebrow="Promotions"
      title="Promotion budget"
      description="Budget authority and settlement remain outside this protected presentation surface."
      stateTitle="Promotion budgets are not currently available"
      stateDescription="No balance, allocation, spending, or budget event is inferred or displayed."
      backHref="/store/promotions"
      backLabel="Back to promotions"
    />
  );
}
