import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("pharmacy");

export default function PharmacyServicePage() {
  return <ServiceDetailPage serviceId="pharmacy" />;
}
