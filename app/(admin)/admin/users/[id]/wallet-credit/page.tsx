import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminCustomerWalletGrantForm } from "@/components/admin/AdminCustomerWalletGrantForm";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { getUserDetail } from "@/lib/services/admin-users.service";
import { getCustomerWalletSummary } from "@/lib/services/customer-wallet.service";

export const metadata: Metadata = { title: "Customer wallet credit | KT Couriers" };

export default async function CustomerWalletGrantPage({ params }: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireAdminPagePermission(PERMISSIONS.USERS_READ);
  if (actor.role !== "SUPER_ADMIN") redirect("/admin/users");
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail || detail.user.role !== "CUSTOMER" || detail.user.status !== "ACTIVE") notFound();
  const summary = await getCustomerWalletSummary(id);
  return (
    <ProtectedPageFrame>
      <ProtectedPageHeader eyebrow="People and network" title="Credit customer wallet"
        description="Superuser-only owner-funded bonus credit. Every credit is posted as an immutable balanced financial journal."/>
      <OperationalPanel title={detail.user.name ?? "Customer account"} description={detail.user.email}>
        <p className="mb-5 text-sm">Current available wallet balance: <strong>R{summary.availableBalance}</strong></p>
        <AdminCustomerWalletGrantForm customerUserId={id} />
      </OperationalPanel>
    </ProtectedPageFrame>
  );
}
