import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export default function BookMovingPage() {
  return <CustomerUnavailablePage eyebrow="Delivery request" title="Book furniture removal" description="Request removals service when its estimate and booking authority are available." stateTitle="Online removal estimates are unavailable" stateDescription="Household removals coordination and automated volume estimates are disabled for this route. No booking or payment has been created." backHref="/account/request-delivery" backLabel="Request a parcel delivery" />;
}
