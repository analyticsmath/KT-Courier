"use client";

import { useState } from "react";
import { ProtectedDrawer } from "@/components/protected-v2/overlays/ProtectedDrawer";
import styles from "./CustomerPresentation.module.css";

export type CustomerOrderFilterOption = Readonly<{ value: string; label: string }>;

export function CustomerOrderFilters({ activeStatus, options }: { activeStatus: string; options: readonly CustomerOrderFilterOption[] }) {
  const [open, setOpen] = useState(false);
  const controls = (
    <label className={styles.filterLabel}>
      Delivery status
      <select className={styles.filterSelect} defaultValue={activeStatus} name="status">
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );

  return (
    <>
      <form action="/account/orders" className={styles.filterDesktop}>{controls}<button className={styles.filterSubmit} type="submit">Apply</button></form>
      <div className={styles.filterMobile}>
        <button className={styles.action} onClick={() => setOpen(true)} type="button">Filter deliveries{activeStatus ? ": active" : ""}</button>
        <ProtectedDrawer description="Filter the delivery records shown on this page." onClose={() => setOpen(false)} open={open} side="right" title="Filter deliveries">
          <form action="/account/orders" className={styles.stack}>{controls}<button className={styles.filterSubmit} type="submit">Apply filter</button></form>
        </ProtectedDrawer>
      </div>
    </>
  );
}
