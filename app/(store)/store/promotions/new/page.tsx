import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
import { businessPromotionTargets } from "@/lib/client-platform/promotion-authoring.service";
import { PromotionDraftForm } from "@/components/forms/PromotionDraftForm";
export default async function Page() {
  const a = await requireBusinessPage("/store/promotions/new"),
    targets = await businessPromotionTargets(a.user.id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title="New promotion"
        description="Prepare a coupon or automatic discount for review."
      />
      <OperationalPanel title="Campaign details">
        <PromotionDraftForm {...targets} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
