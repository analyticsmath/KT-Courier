import type { Metadata } from "next";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterProgramPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterProgramRecords } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter programmes" };

export default async function Page() {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_PROGRAMS_READ });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Programmes unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Programmes unavailable" />;
  return <PromoterProgramPage programs={await getPromoterProgramRecords(account.id)} />;
}
