import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("business");

export default function BusinessServicePage() {
  return <ServiceDetailPage serviceId="business" />;
}
