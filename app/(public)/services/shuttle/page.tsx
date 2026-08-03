import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("shuttle");

export default function ShuttleServicePage() {
  return <ServiceDetailPage serviceId="shuttle" />;
}
