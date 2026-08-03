import { EditorialTable, OperationalPanel, ProtectedPagination } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney } from "@/lib/customer-presentation/customer-order-presentation";
import { requireAuth } from "@/lib/auth/guards";
import { listCustomerWalletTransactions } from "@/lib/services/customer-wallet.service";

const PAGE_SIZE = 20;

export default async function CustomerWalletTransactionsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const user = await requireAuth();
  const query = await searchParams;
  const pageValue = Number(query.page);
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;
  const transactions = await listCustomerWalletTransactions(user.id, { page, pageSize: PAGE_SIZE });
  const rows = transactions.data.map((transaction) => ({ ...transaction, id: transaction.journalReference }));
  return (
    <CustomerPage eyebrow="Customer funds" title="Wallet activity" description="Customer-safe, immutable wallet activity in ZAR." actions={<CustomerAction href="/account/wallet">Back to wallet</CustomerAction>}>
      <OperationalPanel title="Transactions">
        <EditorialTable
          caption="Wallet transactions"
          mobileMode="stack"
          rows={rows}
          emptyState={<p className="eo-table-empty" role="status">No wallet transactions yet.</p>}
          columns={[
            { id: "date", header: "Posted", cell: (transaction) => formatCustomerDateTime(transaction.postedAt) ?? "—" },
            { id: "description", header: "Description", cell: (transaction) => transaction.description ?? "Wallet refund credit" },
            { id: "direction", header: "Direction", cell: (transaction) => transaction.direction === "CREDIT" ? "Credit" : "Debit" },
            { id: "amount", header: "Amount", align: "end", cell: (transaction) => `${transaction.direction === "CREDIT" ? "+" : "−"}${formatCustomerMoney(transaction.amount, transaction.currency)}` },
          ]}
        />
      </OperationalPanel>
      <ProtectedPagination currentPage={page} pageCount={transactions.pagination.totalPages} hrefForPage={(nextPage) => `/account/wallet/transactions?page=${nextPage}`} />
    </CustomerPage>
  );
}
