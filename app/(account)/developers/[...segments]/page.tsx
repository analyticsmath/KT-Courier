import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeveloperPortalPage } from "@/components/protected-v2/developer";
import { requireAuth } from "@/lib/auth/guards";
import { getDeveloperOwnerCapabilities, getDeveloperPresentationSnapshot, resolveDeveloperPortalRoute } from "@/lib/developer-presentation";
import { isProtectedContextAvailableToRole } from "@/lib/protected-navigation";
import { noIndexPublicMetadata } from "@/lib/public-site/site-metadata";

type DeveloperPortalPageProps = { params: Promise<{ segments: string[] }> };

export const metadata: Metadata = { ...noIndexPublicMetadata, robots: { index: false, follow: false, nocache: true } };

export default async function DeveloperPortalRoute({ params }: DeveloperPortalPageProps) {
  const [user, { segments }] = await Promise.all([requireAuth(), params]);
  if (!isProtectedContextAvailableToRole(user.role, "DEVELOPER")) redirect("/");
  const capabilities = await getDeveloperOwnerCapabilities({ userId: user.id, role: user.role });
  const snapshot = await getDeveloperPresentationSnapshot(user.id, capabilities);
  return <DeveloperPortalPage route={resolveDeveloperPortalRoute(segments)} snapshot={snapshot} capabilities={capabilities} />;
}
