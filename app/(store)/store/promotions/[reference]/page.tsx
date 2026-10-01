import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import {
  ProtectedPageFrame,
  ProtectedPageHeader,
  OperationalPanel,
} from "@/components/protected-v2";
import { notFound } from "next/navigation";
import {
  getBusinessPromotion,
  businessPromotionTargets,
} from "@/lib/client-platform/promotion-authoring.service";
import { PlatformError } from "@/lib/client-platform/contracts";
import {
  PromotionDraftForm,
  PromotionSubmitButton,
} from "@/components/forms/PromotionDraftForm";
export default async function Page({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const a = await requireBusinessPage("/store/promotions/[reference]"),
    { reference } = await params;
  let c;
  try {
    c = await getBusinessPromotion(a.user.id, reference);
  } catch (e) {
    if (e instanceof PlatformError && e.status === 404) notFound();
    throw e;
  }
  const targets =
    c.status === "DRAFT" ? await businessPromotionTargets(a.user.id) : null;
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        title={c.name}
        description={`${c.status.replaceAll("_", " ")} · ${c.reference}`}
      />
      <nav className="flex flex-wrap gap-5" aria-label="Campaign">
        <Link href="/store/promotions">Back to promotions</Link>
        <Link href={`/store/promotions/${reference}/budget`}>Budget</Link>
        <Link href={`/store/promotions/${reference}/redemptions`}>
          Redemptions
        </Link>
      </nav>
      <OperationalPanel title="Campaign summary">
        <p>{c.description}</p>
        {c.reviewFeedback && <p>Review feedback: {c.reviewFeedback}</p>}
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt>Discount</dt>
            <dd>
              {c.mechanism === "PERCENTAGE" ? `${c.value}%` : `R ${c.value}`}
            </dd>
          </div>
          <div>
            <dt>Proposed budget</dt>
            <dd>R {c.proposedBudget}</dd>
          </div>
          <div>
            <dt>Redemptions</dt>
            <dd>{c.redemptions}</dd>
          </div>
          <div>
            <dt>Coupon</dt>
            <dd>{c.couponMasked ?? "Automatic"}</dd>
          </div>
          <div>
            <dt>Valid from / until (UTC)</dt>
            <dd>
              {c.startsAt} / {c.endsAt}
            </dd>
          </div>
          <div>
            <dt>Usage limits</dt>
            <dd>
              {c.globalLimit} total, {c.perCustomerLimit} per customer
            </dd>
          </div>
        </dl>
        {c.status === "APPROVED" && (
          <p>Rules approved. This promotion is not active yet.</p>
        )}
        {c.status === "UNDER_REVIEW" && (
          <p className="mt-4">
            Submitted for platform review. This promotion is not active.
          </p>
        )}
      </OperationalPanel>
      {targets && (
        <>
          <OperationalPanel title="Edit draft">
            <PromotionDraftForm key={c.revision} initial={c} {...targets} />
          </OperationalPanel>
          <OperationalPanel
            title="Submit for review"
            description="Save your changes before submitting. Submitted rules are locked during review."
          >
            <PromotionSubmitButton
              reference={c.reference}
              revision={c.revision}
            />
          </OperationalPanel>
        </>
      )}
    </ProtectedPageFrame>
  );
}
