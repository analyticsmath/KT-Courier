import React from "react";
import styles from "./dashboard.module.css";

export type DashboardCardTone =
  | "surface"
  | "muted"
  | "dark"
  | "brand"
  | "orange"
  | "green"
  | "lime";

export type DashboardCardPadding = "compact" | "normal" | "spacious";

const TONE_CLASSES: Record<DashboardCardTone, string> = {
  surface: styles.toneSurface,
  muted: styles.toneMuted,
  dark: styles.toneDark,
  brand: styles.toneBrand,
  orange: styles.toneOrange,
  green: styles.toneGreen,
  lime: styles.toneLime,
};

const PAD_CLASSES: Record<DashboardCardPadding, string> = {
  compact: styles.padCompact,
  normal: styles.padNormal,
  spacious: styles.padSpacious,
};

export interface DashboardCardProps {
  children: React.ReactNode;
  tone?: DashboardCardTone;
  padding?: DashboardCardPadding;
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}

export function DashboardCard({
  children,
  tone = "surface",
  padding = "normal",
  eyebrow,
  title,
  description,
  action,
  footer,
  className = "",
  as: Component = "section",
}: DashboardCardProps) {
  const hasHeader = Boolean(eyebrow || title || description || action);

  return (
    <Component className={`${styles.card} ${TONE_CLASSES[tone]} ${PAD_CLASSES[padding]} ${className}`}>
      {hasHeader && (
        <div className={styles.cardHeader}>
          <div className={styles.cardHeadingGroup}>
            {eyebrow && <span className={styles.cardEyebrow}>{eyebrow}</span>}
            {title && (typeof title === "string" ? <h3 className={styles.cardTitle}>{title}</h3> : title)}
            {description && (typeof description === "string" ? <p className={styles.cardDescription}>{description}</p> : description)}
          </div>
          {action && <div className={styles.cardAction}>{action}</div>}
        </div>
      )}
      <div className={styles.cardContent}>{children}</div>
      {footer && <div className={styles.cardFooter}>{footer}</div>}
    </Component>
  );
}
