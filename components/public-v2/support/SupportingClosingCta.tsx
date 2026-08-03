import Link from "next/link";
import styles from "./support-pages.module.css";

export function SupportingClosingCta({
  eyebrow,
  title,
  summary,
  primaryAction,
  secondaryAction,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
}) {
  return (
    <section className={styles.closingCta}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{summary}</p>
      <div className={styles.actionGroup}>
        <Link className={styles.primaryAction} href={primaryAction.href}>{primaryAction.label} <span aria-hidden="true">→</span></Link>
        {secondaryAction ? <Link className={styles.secondaryAction} href={secondaryAction.href}>{secondaryAction.label} <span aria-hidden="true">→</span></Link> : null}
      </div>
    </section>
  );
}
