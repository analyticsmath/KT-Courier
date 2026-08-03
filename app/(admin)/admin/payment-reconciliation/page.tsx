import type { Metadata } from "next";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PaymentReconciliationFilters } from "@/components/admin/PaymentConfirmationFilters";
import { PaymentReconciliationTable } from "@/components/admin/PaymentConfirmationTables";
import { LedgerPagination } from "@/components/admin/LedgerPagination";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentReconciliation } from "@/lib/services/payment-confirmation-query.service";
import { PaymentReconciliationListQuerySchema } from "@/lib/validation/payment-confirmation";

export const metadata: Metadata = { title: "Payment Reconciliation" };
type SearchParams = Record<string, string | string[] | undefined>;
const value = (params: SearchParams, key: string) => typeof params[key] === "string" && params[key] ? params[key] as string : undefined;

async function loadPaymentReconciliation(input: Parameters<typeof listPaymentReconciliation>[0]) {
  try {
    return await listPaymentReconciliation(input);
  } catch {
    return null;
  }
}

export default async function PaymentReconciliationPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENT_RECONCILIATION_READ);
  const params = await searchParams;
  const input = { page: value(params, "page") ?? "1", pageSize: "20", provider: "PAYFAST", status: value(params, "status"), priority: value(params, "priority"), reason: value(params, "reason"), paymentReference: value(params, "paymentReference"), attemptReference: value(params, "attemptReference"), eventReference: value(params, "eventReference"), from: value(params, "from"), to: value(params, "to") };
  const parsed = PaymentReconciliationListQuerySchema.safeParse(input);
  let content: React.ReactNode;
  if (!parsed.success) content = <ErrorPanel title="Invalid reconciliation filters" message="Review the filters, then try again." />;
  else {
    const data = await loadPaymentReconciliation(parsed.data);
    content = data
      ? <AdministrationPanel className="space-y-5"><PaymentReconciliationFilters values={input} /><PaymentReconciliationTable cases={data.data} /><LedgerPagination pathname="/admin/payment-reconciliation" searchParams={params} pageParameter="page" page={data.pagination.page} totalPages={data.pagination.totalPages} label="Payment reconciliation pages" /></AdministrationPanel>
      : <ErrorPanel title="Payment reconciliation unavailable" message="The read-only case list could not be loaded. Please try again." />;
  }
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Provider evidence" title="Payment Reconciliation" description="Inspect unresolved and resolved payment evidence without financial mutation controls." />{content}</div>;
}
