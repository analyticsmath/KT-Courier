import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterWithdrawalsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterWalletProjection, getPromoterWithdrawalRecords } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter withdrawals" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_WALLET_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Withdrawals unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Withdrawals unavailable" />;
  const [withdrawals, wallet] = await Promise.all([getPromoterWithdrawalRecords(account.id), getPromoterWalletProjection(account.id)]);
  return <PromoterWithdrawalsPage withdrawals={withdrawals} wallet={wallet} />;
}
