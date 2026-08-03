import type { ReactNode } from "react";
import { publicFontVariables } from "@/app/fonts/public-fonts";
import { PublicVisualRoot } from "@/components/public-v2/foundation/PublicVisualRoot";
import { authMedia } from "@/lib/public-assets/auth-media";
import { AuthHeader } from "./AuthHeader";
import { AuthMediaFrame } from "./AuthMediaFrame";
import styles from "./auth-pages.module.css";

export function AuthShellV2({ children }: { children: ReactNode }) {
  return (
    <PublicVisualRoot className={`${publicFontVariables} ${styles.root}`}>
      <div data-kt-auth-experience="secure-handoff-v1">
        <AuthHeader />
        <main className={styles.content} id="main-content">
          <section className={styles.formPlane} aria-label="Account access">
            <div className={styles.formFrame}>{children}</div>
          </section>
          <AuthMediaFrame asset={authMedia.secureHandoff} />
        </main>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} KT Couriers
        </footer>
      </div>
    </PublicVisualRoot>
  );
}
