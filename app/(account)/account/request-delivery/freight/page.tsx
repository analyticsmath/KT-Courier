import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export default function BookFreightPage() {
  return <CustomerUnavailablePage eyebrow="Delivery request" title="Book cargo freight" description="Request freight service when its quote and booking authority are available." stateTitle="Online freight quotes are unavailable" stateDescription="Automated freight quote calculations and freight booking requests are disabled for this route. No booking or payment has been created." backHref="/account/request-delivery" backLabel="Request a parcel delivery" />;
}
