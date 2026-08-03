import Link from "next/link";
import { EditorialTable, OperationalPanel, ProtectedPagination, ProtectedStatus } from "@/components/protected-v2";
import { CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney, getCustomerRefundStatus } from "@/lib/customer-presentation/customer-order-presentation";
import { RefundRequestForm } from "@/components/refunds/RefundRequestForm";
import { requireAuth } from "@/lib/auth/guards";
import { REFUND_PRODUCTION_READINESS } from "@/lib/refunds/refund-production-readiness";
import { listCustomerRefunds } from "@/lib/services/refund-query.service";

const PAGE_SIZE = 20;

export default async function CustomerRefundsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireAuth();
  const query = await searchParams;
  const pageValue = Number(query.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const refunds = await listCustomerRefunds(user.id, { page, pageSize: PAGE_SIZE });
  const disabledReason = REFUND_PRODUCTION_READINESS.productionValidationApproved ? null : "New refund requests are inactive pending consolidated validation approval. No payment or order status will be changed.";
  const rows = refunds.data.map((refund) => ({ ...refund, id: refund.publicReference }));
  return (
    <CustomerPage eyebrow="Customer payments" title="Refunds" description="Request and track refunds without exposing provider, ledger, or internal review information.">
      <OperationalPanel title="Request a refund" description={disabledReason ? "Refund execution remains locked in the current production state." : "Submit a request using an existing payment reference."}><RefundRequestForm disabledReason={disabledReason} /></OperationalPanel>
      <OperationalPanel title="Refund history">
        <EditorialTable
          caption="Your refund requests"
          mobileMode="stack"
          rows={rows}
          emptyState={<p className="eo-table-empty" role="status">No refund requests yet.</p>}
          columns={[
            { id: "reference", header: "Reference", cell: (refund) => <Link href={`/account/refunds/${refund.publicReference}`} className="font-mono font-semibold text-[var(--eo-operational)] hover:underline">{refund.publicReference}</Link> },
            { id: "amount", header: "Amount", align: "end", cell: (refund) => formatCustomerMoney(refund.amount, refund.currency) },
            { id: "method", header: "Method", cell: (refund) => refund.method === "CUSTOMER_WALLET" ? "Customer wallet" : "Original payment method" },
            { id: "status", header: "Status", cell: (refund) => { const status = getCustomerRefundStatus(refund.status); return <ProtectedStatus label={status.label} tone={status.tone} />; } },
            { id: "requested", header: "Requested", cell: (refund) => formatCustomerDateTime(refund.requestedAt) ?? "—" },
          ]}
        />
      </OperationalPanel>
      <ProtectedPagination currentPage={page} pageCount={refunds.pagination.totalPages} hrefForPage={(nextPage) => `/account/refunds?page=${nextPage}`} />
    </CustomerPage>
  );
}
