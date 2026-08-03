import type { Metadata } from "next";
import { ErrorPanel } from "@/components/ui/ErrorPanel";
import { OperationalPanel } from "@/components/protected-v2/surfaces/OperationalPanel";
import { ProtectedPageFrame } from "@/components/protected-v2/surfaces/ProtectedPageFrame";
import { ProtectedPageHeader } from "@/components/protected-v2/surfaces/ProtectedPageHeader";
import { PaymentFilters } from "@/components/admin/PaymentFilters";
import { PaymentsTable } from "@/components/admin/PaymentTables";
import { LedgerPagination } from "@/components/admin/LedgerPagination";
import { requireAdminPagePermission } from "@/lib/auth/guards";
import { PERMISSIONS } from "@/lib/auth/permission-keys";
import { listPayments } from "@/lib/services/payment-query.service";
import { PaymentListQuerySchema } from "@/lib/validation/payments";

export const metadata: Metadata = { title: "Payments" };
type SearchParams = Record<string, string | string[] | undefined>;
const value = (params: SearchParams, key: string) => typeof params[key] === "string" && params[key] ? params[key] as string : undefined;

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireAdminPagePermission(PERMISSIONS.PAYMENTS_READ);
  const params = await searchParams;
  const input = {
    page: value(params, "page") ?? "1",
    pageSize: "20",
    publicReference: value(params, "publicReference"),
    orderReference: value(params, "orderReference"),
    payer: value(params, "payer"),
    status: value(params, "status"),
    provider: value(params, "provider"),
    from: value(params, "from"),
    to: value(params, "to"),
    minimumAmount: value(params, "minimumAmount"),
    maximumAmount: value(params, "maximumAmount"),
  };
  const parsed = PaymentListQuerySchema.safeParse(input);
  let content: React.ReactNode;
  if (!parsed.success) {
    content = <ErrorPanel title="Invalid payment filters" message="Review the payment filters, then try again." />;
  } else {
    let data: Awaited<ReturnType<typeof listPayments>> | null = null;
    try {
      data = await listPayments(parsed.data);
    } catch {
      data = null;
    }
    if (data) {
      content = <OperationalPanel className="space-y-5" title="Payment records" description="Filters and pagination are resolved by the existing server query authority.">
        <PaymentFilters values={input} />
        <PaymentsTable payments={data.data} />
        <LedgerPagination pathname="/admin/payments" searchParams={params} pageParameter="page" page={data.pagination.page} totalPages={data.pagination.totalPages} label="Payment pages" />
      </OperationalPanel>;
    } else {
      content = <ErrorPanel title="Payments unavailable" message="The read-only payment list could not be loaded. Please try again." />;
    }
  }
  return <ProtectedPageFrame>
    <ProtectedPageHeader eyebrow="Provider lifecycle" title="Payments" description="Inspect provider-neutral payment state and amount evidence. This interface is read-only." />
    {content}
  </ProtectedPageFrame>;
}
