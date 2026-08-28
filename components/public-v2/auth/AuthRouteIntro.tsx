import type { ReactNode } from "react";
import styles from "./auth-pages.module.css";

export type AuthRouteIntroProps = {
  title: string;
  children: ReactNode;
  /** Deprecated in Package A: eyebrows are not rendered visually */
  eyebrow?: string;
};

export function AuthRouteIntro({ title, children }: AuthRouteIntroProps) {
  return (
    <div className={styles.routeIntro}>
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.intro}>{children}</div>
    </div>
  );
}
