import type { Metadata } from "next";
import { AuthShellV2 } from "@/components/public-v2/auth";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

export const metadata: Metadata = noIndexPublicMetadata;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShellV2>{children}</AuthShellV2>;
}
