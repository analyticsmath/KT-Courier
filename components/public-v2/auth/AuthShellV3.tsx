import type { ReactNode } from "react";
import Image from "next/image";
import { publicFontVariables } from "@/app/fonts/public-fonts";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { AuthHeader } from "./AuthHeader";
import { PublicFooter } from "@/components/public-v3/navigation/PublicFooter";
import styles from "./auth-pages.module.css";
import "@/components/public-v3/redesign/redesign.css";

interface AuthShellV3Props {
  children: ReactNode;
  primaryMedia?: string;
  primaryAlt?: string;
}
export function AuthShellV3({
  children,
  primaryMedia,
  primaryAlt,
}: AuthShellV3Props) {
  return (
    <PublicVisualRoot
      className={`${publicFontVariables} ${styles.root} kt-redesign kt-auth-new`}
    >
      <div data-kt-auth-experience="editorial-reset">
        <AuthHeader />
        <main className={styles.content} id="main-content">
          <aside className="kt-auth-image">
            <Image
              src={
                primaryMedia ??
                "/media/public/derived/photo-prep-workshop-dispatch-desk-1440w.webp"
              }
              alt={primaryAlt ?? "A small-business owner preparing a delivery"}
              fill
              sizes="(max-width:1000px) 1px, 30vw"
            />
            <p>
              Good things.
              <br />
              Going places.
            </p>
          </aside>
          <section
            aria-label="Authentication form"
            className={styles.formPlane}
          >
            {children}
          </section>
        </main>
        <PublicFooter />
      </div>
    </PublicVisualRoot>
  );
}
