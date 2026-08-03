import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("pricing");

export default function PricingServicePage() {
  return <ServiceDetailPage serviceId="pricing" />;
}
