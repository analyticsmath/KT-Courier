import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("moving");

export default function MovingServicePage() {
  return <ServiceDetailPage serviceId="moving" />;
}
