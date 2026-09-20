import Link from "next/link";
import styles from "./commerce.module.css";

export type CommerceBreadcrumbItem = {
  label: string;
  href?: string | null;
};

export function CommerceBreadcrumbs({
  items,
  className = "",
}: {
  items: readonly CommerceBreadcrumbItem[];
  className?: string;
}) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className={`${styles.commerceBreadcrumbs} ${className}`}>
      <ol>
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            {index > 0 && (
              <svg aria-hidden="true" className={styles.breadcrumbChevron} viewBox="0 0 16 16" fill="none">
                <path d="m6 3 5 5-5 5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
              </svg>
            )}
            {item.href && index < items.length - 1 ? (
              <Link href={item.href}>{item.label}</Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
