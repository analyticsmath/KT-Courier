import Link from "next/link";
import styles from "./support-pages.module.css";

export function PublicDataState({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  action?: { label: string; href: string };
}) {
  return (
    <aside className={styles.dataState} aria-labelledby="data-state-heading">
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2 id="data-state-heading">{title}</h2>
      <div>{children}</div>
      {action ? <Link className={styles.textAction} href={action.href}>{action.label} <span aria-hidden="true">→</span></Link> : null}
    </aside>
  );
}
