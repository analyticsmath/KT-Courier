import { ServicesOverviewPage } from "@/components/public-v2/services";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Courier services",
  description: "Explore KT Couriers public service routes for local delivery requests, business operations, planned movement, and current quote information.",
  route: "/services",
});

export default function ServicesPage() {
  return <ServicesOverviewPage />;
}
