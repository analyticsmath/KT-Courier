import { PublicHeader } from "@/components/public-v3/navigation/PublicHeader";
import { PublicFooter } from "@/components/public-v3/navigation/PublicFooter";
import { MobileNavigation } from "@/components/public-v3/navigation/MobileNavigation";
import { PublicVisualRoot } from "@/components/public-v3/foundation/PublicVisualRoot";
import { PublicMotionProvider } from "@/components/public-v3/motion/PublicMotionProvider";
import { PublicPageTransition } from "@/components/public-v2/motion/PublicPageTransition";
import { AddToCartFlightPortal } from "@/components/public-v2/commerce/AddToCartFlightPortal";
import { publicFontVariables } from "@/app/fonts/public-fonts";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicMotionProvider>
      <PublicVisualRoot className={`layout-public flex min-h-screen flex-col ${publicFontVariables}`}>
        <PublicHeader />
        <main className="flex-1 scroll-mt-[66px] outline-none" id="main-content" tabIndex={-1}>
          <PublicPageTransition>{children}</PublicPageTransition>
        </main>
        <PublicFooter />
        <MobileNavigation />
        <AddToCartFlightPortal />
      </PublicVisualRoot>
    </PublicMotionProvider>
  );
}

