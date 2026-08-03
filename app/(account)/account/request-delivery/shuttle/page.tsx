import { CustomerUnavailablePage } from "@/components/protected-v2/customer/CustomerPresentation";

export default function BookShuttlePage() {
  return <CustomerUnavailablePage eyebrow="Delivery request" title="Book shuttle transit" description="Request shuttle service when its scheduling and booking authority are available." stateTitle="Online shuttle reservations are unavailable" stateDescription="Passenger route scheduling and seat bookings are disabled for this route. No booking or payment has been created." backHref="/account/request-delivery" backLabel="Request a parcel delivery" />;
}
