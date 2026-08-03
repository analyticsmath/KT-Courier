import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterOverviewPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterOverviewSummary, getPromoterPresentationContext, getPromoterReferralCodes, getPromoterReferralRecords, getPromoterWalletProjection } from "@/lib/promoter-presentation";
import { getProtectedNotificationProjection } from "@/lib/protected-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter overview" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_PROFILE_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Promoter overview unavailable" />;
  const [summary, referralCodes, referrals, wallet, notifications] = await Promise.all([
    getPromoterOverviewSummary(account.id), getPromoterReferralCodes(account.id), getPromoterReferralRecords(account.id, 5), getPromoterWalletProjection(account.id), getProtectedNotificationProjection(user.id, "/promoter/notifications"),
  ]);
  return <PromoterOverviewPage account={account} referralCodes={referralCodes} referrals={referrals} wallet={wallet} pendingQualificationCount={summary.pendingQualificationCount} activeCodeCount={summary.activeCodeCount} heldEarnings={summary.heldEarnings} pendingWithdrawalCount={summary.pendingWithdrawalCount} unreadNotifications={notifications.unreadCount} />;
}
