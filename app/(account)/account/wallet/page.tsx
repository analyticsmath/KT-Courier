import { customerRefundWalletDisplayState } from "@/lib/services/customer-wallet-presentation";
import { listCustomerRecentPayments } from "@/lib/services/customer-recent-payments.service";
import { EditorialTable, MetricTile, OperationalPanel, ProtectedState } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";
import { formatCustomerDateTime, formatCustomerMoney } from "@/lib/customer-presentation/customer-order-presentation";
import { requireAuth } from "@/lib/auth/guards";
import { getCustomerWalletSummary, listCustomerWalletTransactions } from "@/lib/services/customer-wallet.service";

export default async function CustomerWalletPage() {
  const user = await requireAuth();
  const [wallet, transactions, recentPayments] = await Promise.all([
    getCustomerWalletSummary(user.id),
    listCustomerWalletTransactions(user.id, { page: 1, pageSize: 5 }),
    listCustomerRecentPayments(user.id),
  ]);

  const walletState = customerRefundWalletDisplayState(wallet);
  return (
    <CustomerPage eyebrow="Customer funds" title="Wallet" description="Source-backed refund credits held for your account in ZAR.">
      {walletState !== "AVAILABLE" ? (
        <ProtectedState
          kind={walletState === "EMPTY" ? "empty" : "unavailable"}
          title={walletState === "EMPTY" ? "No refund credits yet" : "Wallet records are unavailable"}
          description={walletState === "EMPTY"
            ? "Your refund-credit wallet is created when a qualifying refund needs to be recorded. Payments are listed below separately."
            : "Your provisioned refund-credit wallet cannot be read right now. Please contact support."}
        />
      ) : <>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MetricTile label="Available balance" value={formatCustomerMoney(wallet.availableBalance, wallet.currency)} description="Refund credits available in this read-only wallet" />
          <MetricTile label="Refunds being held" value={formatCustomerMoney(wallet.refundHeldBalance, wallet.currency)} description="Reserved refunds are not spendable" />
        </div>
        <OperationalPanel title="Recent wallet activity" action={<CustomerAction href="/account/wallet/transactions">View all activity</CustomerAction>}>
          <EditorialTable
            caption="Recent wallet activity"
            mobileMode="stack"
            rows={transactions.data.map((transaction) => ({ ...transaction, id: transaction.journalReference }))}
            emptyState={<p className="eo-table-empty" role="status">No wallet transactions yet.</p>}
            columns={[
              { id: "date", header: "Posted", cell: (transaction) => formatCustomerDateTime(transaction.postedAt) ?? "—" },
              { id: "description", header: "Description", cell: (transaction) => transaction.description ?? "Wallet refund credit" },
              { id: "amount", header: "Amount", align: "end", cell: (transaction) => `${transaction.direction === "CREDIT" ? "+" : "−"}${formatCustomerMoney(transaction.amount, transaction.currency)}` },
            ]}
          />
        </OperationalPanel>
      </>}
      <OperationalPanel title="Recent payments" description="Actual parcel and marketplace payment records, separate from your refund-credit wallet. Test transactions are identified as sandbox payments.">
        <EditorialTable
          caption="Recent payments"
          mobileMode="stack"
          rows={recentPayments.map((payment) => ({ ...payment, id: payment.reference }))}
          emptyState={<p className="eo-table-empty" role="status">No payments recorded for this account yet.</p>}
          columns={[
            { id: "date", header: "Date", cell: (payment) => formatCustomerDateTime(payment.createdAt) ?? "—" },
            { id: "reference", header: "Payment", cell: (payment) => payment.reference },
            { id: "purpose", header: "For", cell: (payment) => payment.description },
            { id: "status", header: "Status", cell: (payment) => payment.status.replaceAll("_", " ") },
            { id: "mode", header: "Mode", cell: (payment) => payment.environment === "SANDBOX" ? "Test mode" : payment.environment === "PRODUCTION" ? "Live" : "Not started" },
            { id: "amount", header: "Amount", align: "end", cell: (payment) => formatCustomerMoney(payment.amount, payment.currency) },
          ]}
        />
      </OperationalPanel>
      <OperationalPanel title="Wallet boundary"><p className="text-sm leading-6 text-[var(--eo-text-secondary)]">This wallet is read-only. It cannot be topped up, transferred, withdrawn, or used at checkout in the current product state.</p></OperationalPanel>
    </CustomerPage>
  );
}
