import React from "react";
import styles from "./dashboard.module.css";

export function DashboardCanvas({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`${styles.ktDashboard} ${className}`}>
      <div className={styles.canvas}>
        {children}
      </div>
    </div>
  );
}
