import type { Metadata } from "next";
import { AdministrationPanel } from "@/components/protected-v2/admin/AdministrationRoutePrimitives";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PaymentWebhookFilters } from "@/components/admin/PaymentConfirmationFilters";
import { PaymentWebhooksTable } from "@/components/admin/PaymentConfirmationTables";
import { LedgerPagination } from "@/components/admin/LedgerPagination";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPaymentWebhooks } from "@/lib/services/payment-confirmation-query.service";
import { PaymentWebhookListQuerySchema } from "@/lib/validation/payment-confirmation";

export const metadata: Metadata = { title: "Payment Webhooks" };
type SearchParams = Record<string, string | string[] | undefined>;
const value = (params: SearchParams, key: string) => typeof params[key] === "string" && params[key] ? params[key] as string : undefined;

async function loadPaymentWebhooks(input: Parameters<typeof listPaymentWebhooks>[0]) {
  try {
    return await listPaymentWebhooks(input);
  } catch {
    return null;
  }
}

export default async function PaymentWebhooksPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENT_WEBHOOKS_READ);
  const params = await searchParams;
  const input = { page: value(params, "page") ?? "1", pageSize: "20", provider: "PAYFAST", environment: value(params, "environment"), processingStatus: value(params, "processingStatus"), normalizedStatus: value(params, "normalizedStatus"), paymentReference: value(params, "paymentReference"), attemptReference: value(params, "attemptReference"), reconciliationRequired: value(params, "reconciliationRequired"), from: value(params, "from"), to: value(params, "to") };
  const parsed = PaymentWebhookListQuerySchema.safeParse(input);
  let content: React.ReactNode;
  if (!parsed.success) content = <ErrorPanel title="Invalid webhook filters" message="Review the filters, then try again." />;
  else {
    const data = await loadPaymentWebhooks(parsed.data);
    content = data
      ? <AdministrationPanel className="space-y-5"><PaymentWebhookFilters values={input} /><PaymentWebhooksTable events={data.data} /><LedgerPagination pathname="/admin/payment-webhooks" searchParams={params} pageParameter="page" page={data.pagination.page} totalPages={data.pagination.totalPages} label="Payment webhook pages" /></AdministrationPanel>
      : <ErrorPanel title="Payment webhooks unavailable" message="The read-only event list could not be loaded. Please try again." />;
  }
  return <div className="max-w-7xl space-y-6"><ProtectedPageHeader eyebrow="Provider evidence" title="Payment Webhooks" description="Inspect safe Payfast verification and application evidence. This interface is read-only." />{content}</div>;
}
