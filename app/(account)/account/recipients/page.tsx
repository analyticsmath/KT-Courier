import type { Metadata } from "next";
import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export const metadata: Metadata = { title: "Saved recipients" };

export default function RecipientsPage() {
  return <CustomerUnavailablePage eyebrow="Delivery details" title="Saved recipients" description="Reuse recipient details when a canonical recipient book is available." stateTitle="Saved recipients are unavailable" stateDescription="This route has no connected recipient-book authority. Recipient details continue to be entered as part of an individual delivery request." backHref="/account/request-delivery" backLabel="Request a delivery" />;
}
