import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterProfilePage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter compliance" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_PROFILE_READ_OWN });
  if (!context.account) return <PromoterAccountUnavailablePage title="Compliance unavailable" />;
  return context.canReadRecords ? <PromoterProfilePage account={context.account} compliance /> : <PromoterAccessRestrictedPage account={context.account} title="Compliance unavailable" />;
}
