import { FaqPage } from "@/components/public-v2/faq";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Frequently asked questions",
  description: "Find practical KT Couriers answers about delivery requests, current quotes, coverage, account updates, business pathways, membership, and support.",
  route: "/faq",
});

export default function FaqRoutePage() {
  return <FaqPage />;
}
