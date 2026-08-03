import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("food");

export default function FoodServicePage() {
  return <ServiceDetailPage serviceId="food" />;
}
