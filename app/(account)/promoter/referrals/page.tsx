import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterReferralsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterReferralRecords } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Attributed referrals" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_REFERRALS_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Attributed referrals unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Attributed referrals unavailable" />;
  return <PromoterReferralsPage referrals={await getPromoterReferralRecords(account.id)} />;
}
