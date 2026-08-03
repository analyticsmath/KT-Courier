import type { ReactNode } from "react";
import styles from "./auth-pages.module.css";

type AuthRouteIntroProps = {
  title: string;
  children: ReactNode;
  eyebrow?: string;
};

export function AuthRouteIntro({ title, children, eyebrow }: AuthRouteIntroProps) {
  return (
    <div className={styles.routeIntro}>
      {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
      <h1 className={styles.title}>{title}</h1>
      <div className={styles.intro}>{children}</div>
    </div>
  );
}
