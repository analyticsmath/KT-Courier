import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { PublicSmoothScroll } from "@/components/public-v2/motion/PublicSmoothScroll";
import { MobilePublicNavigation } from "@/components/public-v2/site/MobilePublicNavigation";
import { publicFontVariables } from "@/app/fonts/public-fonts";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicSmoothScroll>
      <PublicVisualRoot className={`layout-public flex min-h-screen flex-col ${publicFontVariables}`}>
        <PublicHeader />
        <main className="flex-1" id="main-content">{children}</main>
        <PublicFooter />
        <MobilePublicNavigation />
      </PublicVisualRoot>
    </PublicSmoothScroll>
  );
}
