import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { listDeliveryReviews } from "@/lib/client-platform/reviews.service";
import { DeliveryReviews } from "@/components/forms/DeliveryReviews";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function Page() {
  const { user } = await requireBusinessPage("/store/reviews");
  const reviews = await listDeliveryReviews(user.id, true);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Delivery experience"
        title="Reviews"
        description="Reviews from completed deliveries and business responses."
      />
      <OperationalPanel title="Delivery reviews">
        <DeliveryReviews reviews={reviews} business={true} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
