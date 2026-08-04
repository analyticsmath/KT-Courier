import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth/current-user";
import { DeveloperOverviewPage } from "@/components/public-v2/developers";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { publicFontVariables } from "@/app/fonts/public-fonts";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";
import { ProtectedPageFrame } from "@/components/protected-v2";

export const metadata: Metadata = publicPageMetadata({
  title: "Developer API",
  description: "Documentation-led entry to the KT Couriers server-to-server developer API.",
  route: "/developers",
});

export default async function PublicDevelopersPage() {
  const signedIn = Boolean(await getCurrentUser());
  return (
    <PublicVisualRoot className={`layout-public flex min-h-screen flex-col ${publicFontVariables}`}>
      <PublicHeader />
      <main className="flex-1" id="main-content">
        {signedIn ? (
          <ProtectedPageFrame>
            <DeveloperOverviewPage signedIn={signedIn} />
          </ProtectedPageFrame>
        ) : (
          <DeveloperOverviewPage signedIn={signedIn} />
        )}
      </main>
      <PublicFooter />
    </PublicVisualRoot>
  );
}
