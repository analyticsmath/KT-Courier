import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterReferralDetailPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterReferralRecord } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Attributed referral" };

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_REFERRALS_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Referral unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Referral unavailable" />;
  const { reference } = await params;
  const referral = await getPromoterReferralRecord(account.id, reference);
  if (!referral) notFound();
  return <PromoterReferralDetailPage referral={referral} />;
}
