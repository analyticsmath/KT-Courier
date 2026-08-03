import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterDisputesPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterDisputes, getPromoterPresentationContext } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter disputes" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Disputes unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Disputes unavailable" />;
  return <PromoterDisputesPage disputes={await getPromoterDisputes(account.id)} />;
}
