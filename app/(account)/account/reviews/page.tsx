import { requireAuth } from "@/lib/auth/guards";
import { listDeliveryReviews } from "@/lib/client-platform/reviews.service";
import { DeliveryReviews } from "@/components/forms/DeliveryReviews";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function Page() {
  const user = await requireAuth();
  const reviews = await listDeliveryReviews(user.id, false);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Delivery experience"
        title="Reviews"
        description="Reviews from completed deliveries and business responses."
      />
      <OperationalPanel title="Delivery reviews">
        <DeliveryReviews reviews={reviews} business={false} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
