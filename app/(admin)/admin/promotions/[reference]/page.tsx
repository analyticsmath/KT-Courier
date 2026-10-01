import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { notFound } from "next/navigation";
import { getAdminPromotionRecord } from "@/lib/client-platform/promotion-authoring.service";
import { PromotionReviewForm } from "@/components/forms/PromotionReviewForm";
import { PlatformError } from "@/lib/client-platform/contracts";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const user = await requireAdminPagePermission(PERMISSIONS.PROMOTIONS_READ);
  let c;
  try {
    c = await getAdminPromotionRecord(user, (await params).reference);
  } catch (e) {
    if (e instanceof PlatformError && e.status === 404) notFound();
    throw e;
  }
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title={c.name}
        description={`${c.storeName} · ${c.status}`}
      />
      <Link href="/admin/promotions">Back to promotion review</Link>
      <OperationalPanel title="Submitted campaign">
        <p>{c.description}</p>
        <p>
          Discount: {c.value}
          {c.mechanism === "PERCENTAGE" ? "%" : " ZAR"} · Coupon:{" "}
          {c.couponMasked ?? "Automatic"}
        </p>
        <p>
          Proposed budget: R {c.proposedBudget} · Maximum discount:{" "}
          {c.maximumDiscountAmount ?? "No cap proposed"} · Minimum subtotal:{" "}
          {c.minimumSubtotal ?? "None"}
        </p>
        <p>
          Dates (UTC): {c.startsAt} – {c.endsAt}
        </p>
        <p>
          Usage limits: {c.globalLimit} total, {c.perCustomerLimit} per customer
        </p>
        <p>
          Product targets: {c.productIds.join(", ") || "All catalog products"}
        </p>
        <p>
          Category targets:{" "}
          {c.categoryIds.join(", ") || "All catalog categories"}
        </p>
        {c.reviewFeedback && <p>Feedback: {c.reviewFeedback}</p>}
      </OperationalPanel>
      {c.status === "UNDER_REVIEW" && (
        <OperationalPanel title="Review">
          <PromotionReviewForm reference={c.reference} revision={c.revision} />
        </OperationalPanel>
      )}
      {c.status === "APPROVED" && (
        <p>
          Rules approved. Discounts remain inactive until funding and checkout
          activation are available.
        </p>
      )}
    </ProtectedPageFrame>
  );
}
