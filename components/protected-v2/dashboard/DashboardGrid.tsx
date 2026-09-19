import React from "react";
import styles from "./dashboard.module.css";

export type GridColSpan = 12 | 8 | 7 | 6 | 5 | 4 | 3;

const SPAN_CLASSES: Record<GridColSpan, string> = {
  12: styles.col12,
  8: styles.col8,
  7: styles.col7,
  6: styles.col6,
  5: styles.col5,
  4: styles.col4,
  3: styles.col3,
};

export function DashboardGrid({
  children,
  className = "",
  ariaLabel,
}: {
  children: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={`${styles.grid} ${className}`} aria-label={ariaLabel} role={ariaLabel ? "region" : undefined}>
      {children}
    </div>
  );
}

export function DashboardCol({
  span = 12,
  children,
  className = "",
}: {
  span?: GridColSpan;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`${SPAN_CLASSES[span]} ${className}`}>
      {children}
    </div>
  );
}
