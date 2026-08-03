import type { Metadata } from "next";
import { OperationalPanel } from "@/components/protected-v2";
import { CustomerAction, CustomerPage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Support" };

export default function AccountSupportPage() {
  return (
    <CustomerPage eyebrow="Help" title="Support" description="Get help with a delivery or your account.">
      <OperationalPanel title="Contact KT Couriers" description="Use the existing contact pathway for delivery questions, account help, or an issue with a delivery."><CustomerAction href="/contact" tone="primary">Contact support</CustomerAction></OperationalPanel>
      <OperationalPanel title="Before you contact us"><ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-[var(--eo-text-secondary)]"><li>Include the delivery reference when your question concerns an existing delivery.</li><li>Use My deliveries to review the customer-safe status history first.</li><li>Do not include card or banking details in a support message.</li></ul></OperationalPanel>
    </CustomerPage>
  );
}
