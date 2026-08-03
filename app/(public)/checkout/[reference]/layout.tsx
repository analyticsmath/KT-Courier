import type { Metadata } from "next";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

/** Reference-bearing checkout routes must not inherit the public home canonical. */
export const metadata: Metadata = noIndexPublicMetadata;

export default function CheckoutReferenceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
