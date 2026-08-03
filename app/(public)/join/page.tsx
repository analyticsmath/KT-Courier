import { ParticipationPage } from "@/components/public-v2/participation";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

// canonical: "/join"
export const metadata = publicPageMetadata({
  title: "Join the network",
  description: "Explore the current KT Couriers participation routes for stores, drivers, and promoters.",
  route: "/join",
});

export default function JoinPage() {
  return <ParticipationPage />;
}
