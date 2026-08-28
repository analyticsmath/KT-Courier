import type { ReactNode } from "react";
import { publicFontVariables } from "@/app/fonts/public-fonts";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { AuthHeader } from "./AuthHeader";
import { AuthMediaComposition } from "./AuthMediaComposition";
import styles from "./auth-pages.module.css";

interface AuthShellV3Props {
  children: ReactNode;
  primaryMedia?: string;
  primaryAlt?: string;
}

export function AuthShellV3({ children, primaryMedia, primaryAlt }: AuthShellV3Props) {
  return (
    <PublicVisualRoot className={`${publicFontVariables} ${styles.root}`}>
      <div data-kt-auth-experience="package-a-v3">
        <AuthHeader />
        <main className={styles.content} id="main-content">
          <section aria-label="Authentication form" className={styles.formPlane}>
            {children}
          </section>
          <AuthMediaComposition primaryAlt={primaryAlt} primaryImage={primaryMedia} />
        </main>
        <footer className={styles.footer}>
          &copy; {new Date().getFullYear()} KT Couriers (Pty) Ltd. All rights reserved.
        </footer>
      </div>
    </PublicVisualRoot>
  );
}
