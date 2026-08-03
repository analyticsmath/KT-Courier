import type { Metadata } from "next";
import { PublicNotFound } from "@/components/public-v2/errors";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The requested KT Couriers page could not be found.",
  robots: { index: false, follow: true, nocache: true },
};

export default function NotFound() {
  return <PublicNotFound />;
}
