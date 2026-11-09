import { requireAuth } from "@/lib/auth/guards";
import { listDeliveryReviews } from "@/lib/client-platform/reviews.service";
import { listMyDriverReviewOpportunities, listMyDriverReviews } from "@/lib/client-platform/driver-reviews.service";
import { DriverReviewSubmission } from "@/components/forms/DriverReviewSubmission";
import { DeliveryReviews } from "@/components/forms/DeliveryReviews";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
export default async function Page() {
  const user = await requireAuth();
  const [reviews, opportunities, driverReviews] = await Promise.all([
    listDeliveryReviews(user.id, false),
    user.role === "CUSTOMER" ? listMyDriverReviewOpportunities(user.id) : Promise.resolve([]),
    user.role === "CUSTOMER" ? listMyDriverReviews(user.id) : Promise.resolve([]),
  ]);
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
      {user.role === "CUSTOMER" && <OperationalPanel title="Rate your delivery driver"
        description="Only a completed delivery with one identifiable completing courier is eligible; this is separate from the store and delivery experience rating.">
        <DriverReviewSubmission opportunities={opportunities} />
        {driverReviews.length > 0 && <div className="mt-6 space-y-3">
          <h3 className="font-semibold">Your driver reviews</h3>
          {driverReviews.map(review => <div className="rounded-xl border border-[var(--kt-border)] p-4" key={review.id}>
            <p className="text-sm font-semibold">{review.order.orderNumber} · {review.driver.displayName ?? review.driver.driverCode} · {review.rating}/5</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{review.body}</p>
          </div>)}
        </div>}
      </OperationalPanel>}
    </ProtectedPageFrame>
  );
}
