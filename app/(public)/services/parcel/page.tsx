import { ServiceDetailPage } from "@/components/public-v2/services";
import { publicServiceMetadata } from "@/lib/public-services/service-page-registry";

export const metadata = publicServiceMetadata("parcel");

export default function ParcelServicePage() {
  return <ServiceDetailPage serviceId="parcel" />;
}
