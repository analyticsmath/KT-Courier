import { StoreCommercialUnavailablePage } from "@/components/protected-v2/store/StoreCommercialUnavailablePage";

export default function StoreSubscriptionBillingPage() {
  return <StoreCommercialUnavailablePage eyebrow="Membership" title="Store membership billing" description="Billing information remains subject to its current financial and production controls." stateTitle="Store membership billing is not currently available" stateDescription="No invoice, payment, cancellation, or provider state is inferred or displayed." backHref="/store/subscription" backLabel="Back to membership" />;
}
