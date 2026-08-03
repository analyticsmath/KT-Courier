import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterDisputesPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterDisputes, getPromoterPresentationContext } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter dispute" };

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Dispute unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Dispute unavailable" />;
  const [disputes, { reference }] = await Promise.all([getPromoterDisputes(account.id), params]);
  const selected = disputes.find((dispute) => dispute.publicReference === reference) ?? null;
  if (!selected) notFound();
  return <PromoterDisputesPage disputes={disputes} selected={selected} />;
}
