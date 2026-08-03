import { MembershipPage } from "@/components/public-v2/membership";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Membership information",
  description: "Read the current public status of KT Couriers membership information. Online activation, prices, and checkout are not currently presented.",
  route: "/membership",
});

export default function MembershipRoutePage() {
  return <MembershipPage />;
}
