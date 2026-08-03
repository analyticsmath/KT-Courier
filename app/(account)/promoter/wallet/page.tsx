import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterWalletPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterWalletProjection } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter wallet" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_WALLET_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Wallet unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Wallet unavailable" />;
  return <PromoterWalletPage wallet={await getPromoterWalletProjection(account.id)} />;
}
