import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("freight");

export default function FreightServicePage() {
  return <ServiceDetailPage serviceId="freight" />;
}
