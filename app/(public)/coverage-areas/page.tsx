import { CoveragePage } from "@/components/public-v2/coverage";
import { getPublicCoverageSnapshot } from "@/lib/public-coverage/coverage";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Coverage areas",
  description: "See configured public KT Couriers delivery regions and learn how pickup and dropoff availability is confirmed for a specific request.",
  route: "/coverage-areas",
});

export default async function CoverageAreasRoutePage() {
  return <CoveragePage snapshot={await getPublicCoverageSnapshot()} />;
}
