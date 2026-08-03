import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterEarningDetailPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterEarningRecord, getPromoterPresentationContext } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter earning" };

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_EARNINGS_READ_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Earning unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Earning unavailable" />;
  const { reference } = await params;
  const earning = await getPromoterEarningRecord(account.id, reference);
  if (!earning) notFound();
  return <PromoterEarningDetailPage earning={earning} />;
}
