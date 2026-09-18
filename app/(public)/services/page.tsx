import { PublicServicesOverview } from "@/components/public-v3/services/PublicServicesOverview";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Delivery services",
  description: "Explore KT Couriers public delivery services for everyday parcels, e-commerce, business logistics, and planned freight transit.",
  route: "/services",
});

export default function ServicesPage() {
  return <PublicServicesOverview />;
}

