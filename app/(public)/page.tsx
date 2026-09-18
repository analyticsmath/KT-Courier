import type { Metadata } from "next";
import { PublicHomeExperience } from "@/components/public-v3/home";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Marketplace and courier services",
    description: "Shop local marketplace products and explore courier delivery services through the KT Couriers network.",
    route: "/",
  }),
  title: { absolute: "Marketplace and courier services | KT Couriers" },
};

// Canonical Public Homepage Experience (HomepageV2 upgraded to v3)
const HomepageV2 = PublicHomeExperience;

export default function HomePage() {
  return <HomepageV2 />;
}

