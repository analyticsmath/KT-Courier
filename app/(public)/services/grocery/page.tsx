import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("grocery");

export default function GroceryServicePage() {
  return <ServiceDetailPage serviceId="grocery" />;
}
