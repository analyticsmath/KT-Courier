import React from "react";
import styles from "./dashboard.module.css";
import { DashboardIllustrationAsset, type DashboardIllustrationRole } from "./DashboardIllustrationAsset";

export interface DashboardHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  artRole?: DashboardIllustrationRole;
}

export function DashboardHeader({
  eyebrow,
  title,
  description,
  actions,
  artRole,
}: DashboardHeaderProps) {
  return (
    <header className={styles.header}>
      {artRole ? <DashboardIllustrationAsset role={artRole} className={styles.headerArtwork} /> : null}
      <div className={styles.headerLeading}>
        {eyebrow && <span className={styles.eyebrow}>{eyebrow}</span>}
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {actions && <div className={styles.headerActions}>{actions}</div>}
    </header>
  );
}
