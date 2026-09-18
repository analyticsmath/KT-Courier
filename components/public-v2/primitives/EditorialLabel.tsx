import type { ReactNode } from "react";
import styles from "./primitives.module.css";

export type EditorialLabelProps = {
  children: ReactNode;
  variant?: "default" | "signal" | "badge" | "badgeDark";
  className?: string;
};

export function EditorialLabel({
  children,
  variant = "default",
  className = "",
}: EditorialLabelProps) {
  const variantClass = {
    default: styles.editorialLabel,
    signal: `${styles.editorialLabel} ${styles.editorialLabelSignal}`,
    badge: styles.editorialBadge,
    badgeDark: styles.editorialBadgeDark,
  }[variant];

  return <span className={`${variantClass} ${className}`.trim()}>{children}</span>;
}
