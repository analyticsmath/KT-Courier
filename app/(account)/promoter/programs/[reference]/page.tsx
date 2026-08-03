import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PromoterAccessRestrictedPage, PromoterAccountUnavailablePage, PromoterProgramPage } from "@/components/protected-v2/promoter";
import { requireRole } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getPromoterPresentationContext, getPromoterProgramRecords } from "@/lib/promoter-presentation";
import { UserRole } from "@/types/db";

export const metadata: Metadata = { title: "Promoter programme" };

export default async function Page({ params }: { params: Promise<{ reference: string }> }) {
  const user = await requireRole(UserRole.PROMOTER);
  const context = await getPromoterPresentationContext({ userId: user.id, role: user.role, permission: PERMISSIONS.PROMOTER_PROGRAMS_READ });
  const account = context.account;
  if (!account) return <PromoterAccountUnavailablePage title="Programme unavailable" />;
  if (!context.canReadRecords) return <PromoterAccessRestrictedPage account={account} title="Programme unavailable" />;
  const { reference } = await params;
  const programs = await getPromoterProgramRecords(account.id);
  const selected = programs.find((program) => program.publicReference === reference) ?? null;
  if (!selected) notFound();
  return <PromoterProgramPage programs={programs} selected={selected} />;
}
