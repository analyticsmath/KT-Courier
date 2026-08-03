import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterEarningsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterEarningRecords, getPromoterOverviewSummary, getPromoterPresentationContext, getPromoterWalletProjection } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter earnings" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_EARNINGS_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Earnings unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Earnings unavailable" />;
  const [earnings, overview, wallet] = await Promise.all([getPromoterEarningRecords(account.id), getPromoterOverviewSummary(account.id), getPromoterWalletProjection(account.id)]);
  return <PromoterEarningsPage earnings={earnings} heldEarnings={overview.heldEarnings} wallet={wallet} />;
}
