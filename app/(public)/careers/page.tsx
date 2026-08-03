import { CareersPage } from "@/components/public-v2/careers";
import { getPublicCareerOpenings } from "@/lib/public-careers/openings";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata = publicPageMetadata({
  title: "Careers",
  description: "View published KT Couriers recruitment openings and use each role’s canonical details and application pathway when available.",
  route: "/careers",
});

export default async function CareersRoutePage() {
  return <CareersPage snapshot={await getPublicCareerOpenings()} />;
}
