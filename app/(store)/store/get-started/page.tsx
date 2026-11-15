import type { Metadata } from "next";
import Link from "next/link";
import { requireBusinessPage } from "@/lib/client-platform/business-auth";
import { ProtectedState } from "@/components/protected-v2/feedback/ProtectedState";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { StoreOnboardingCockpit } from "@/components/store/StoreOnboardingCockpit";
import { getStoreOnboardingByStoreId } from "@/lib/services/store-onboarding.service";

export const metadata: Metadata = { title: "Get started" };

export default async function StoreGetStartedPage() {
  const access = await requireBusinessPage("/store/get-started");
  const onboarding = await getStoreOnboardingByStoreId(access.store.id);

  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader
        eyebrow="Store setup"
        title="Get started"
        description="Track every step needed to activate your store account, publish your first product, and open public marketplace checkout."
        actions={
          <Link
            className="inline-flex min-h-11 items-center rounded-[var(--eo-radius-control)] border border-[var(--eo-line-strong)] px-4 text-sm font-semibold"
            href="/store/catalog/products/new"
          >
            Add product
          </Link>
        }
      />
      {onboarding ? (
        <StoreOnboardingCockpit onboarding={onboarding} />
      ) : (
        <ProtectedState
          kind="unavailable"
          title="Store onboarding unavailable"
          description="Your business profile could not be loaded for onboarding."
        />
      )}
    </ProtectedPageFrame>
  );
}
