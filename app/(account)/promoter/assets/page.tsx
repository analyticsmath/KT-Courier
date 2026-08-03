import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterAssetsPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterAssets, getPromoterPresentationContext } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Approved marketing assets" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_ASSETS_READ });
  if (!context.account) return <PromoterAccountUnavailablePage title="Marketing assets unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={context.account} title="Marketing assets unavailable" />;
  return <PromoterAssetsPage assets={await getPromoterAssets()} />;
}
