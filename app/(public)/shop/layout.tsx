import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export function generateMetadata(): Metadata {
  return publicPageMetadata({
    title: "Marketplace",
    description: "Browse published products and local stores on KT Couriers.",
    route: "/shop",
  });
}

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
