import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("driver-network");

export default function DriverNetworkServicePage() {
  return <ServiceDetailPage serviceId="driver-network" />;
}
