import type { Metadata } from "next";
import { HomepageV2 } from "@/components/public-v2/home";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = {
  ...publicPageMetadata({
    title: "Marketplace and courier services",
    description: "Shop local marketplace products and explore courier delivery services through the KT Couriers network.",
    route: "/",
  }),
  title: { absolute: "Marketplace and courier services | KT Couriers" },
};

export default function HomePage() {
  return <HomepageV2 />;
}
