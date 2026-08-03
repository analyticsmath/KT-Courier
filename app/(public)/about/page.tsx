import { AboutPage } from "@/components/public-v2/about";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "About",
  description: "Learn how KT Couriers connects account-based delivery requests, operational coordination, and order-status visibility for customers, stores, and businesses.",
  route: "/about",
});

export default function AboutRoutePage() {
  return <AboutPage />;
}
