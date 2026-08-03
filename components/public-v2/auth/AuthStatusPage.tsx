import Link from "next/link";
import { AuthRouteIntro } from "./AuthRouteIntro";
import styles from "./auth-pages.module.css";

type StatusAction = { href: string; label: string; kind?: "primary" | "secondary" };

export function AuthStatusPage({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  actions: readonly StatusAction[];
}) {
  return (
    <>
      <AuthRouteIntro eyebrow={eyebrow} title={title}>{children}</AuthRouteIntro>
      <section className={styles.statusCard} aria-label={title}>
        <div className={styles.statusActions}>
          {actions.map((action) => (
            <Link
              className={action.kind === "secondary" ? styles.secondaryAction : styles.primaryAction}
              href={action.href}
              key={action.href}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
