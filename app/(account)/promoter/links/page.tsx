import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterReferralToolsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterReferralCodes } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Referral tools" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_CODES_MANAGE_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Referral tools unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Referral tools unavailable" />;
  return <PromoterReferralToolsPage codes={await getPromoterReferralCodes(account.id)} />;
}
