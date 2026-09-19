import React from "react";
import styles from "./dashboard.module.css";

export interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
}: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeading}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}
