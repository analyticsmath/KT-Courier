import type { Metadata } from "next";
import Link from "next/link";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PaymentProvidersTable } from "@/components/admin/PaymentTables";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentProviders } from "@/lib/services/payment-query.service";

export const metadata: Metadata = { title: "Payment Providers" };

export default async function AdminPaymentProvidersPage() {
  const viewer = await requireAdminPagePermission(PERMISSIONS.PAYMENT_PROVIDERS_READ);
  const providers = listPaymentProviders();
  return <div className="max-w-6xl space-y-6">
    <ProtectedPageHeader eyebrow="Server readiness" title="Payment Providers" description="Inspect provider capability and configuration readiness without exposing credential values. This interface is read-only." />
    <AdministrationPanel className="space-y-4"><PaymentProvidersTable providers={providers.data} /></AdministrationPanel>
    {viewer.role === "SUPER_ADMIN" && <Link className="inline-block text-sm font-semibold underline underline-offset-4" href="/admin/payment-providers/live-verification">Superadmin: R1 live gateway verification</Link>}
  </div>;
}

