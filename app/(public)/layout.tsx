import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { publicFontVariables } from "@/app/fonts/public-fonts";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicVisualRoot className={`layout-public flex min-h-screen flex-col ${publicFontVariables}`}>
      <PublicHeader />
      <main className="flex-1" id="main-content">{children}</main>
      <PublicFooter />
    </PublicVisualRoot>
  );
}
