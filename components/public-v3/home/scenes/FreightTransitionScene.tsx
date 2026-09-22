"use client";

import Link from "next/link";
import styles from "../post-hero-rebuild.module.css";

const ROUTES = [
  ["Freight", "/services/freight"],
  ["Moving", "/services/moving"],
  ["Business", "/services/business"],
  ["Parcel", "/services/parcel"],
] as const;

export function FreightTransitionScene() {
  return (
    <section className={`${styles.chapter} ${styles.freight}`} data-kt-scene="freight" aria-labelledby="freight-heading" style={{ minHeight: "215svh" }}>
      <div className={styles.sticky} data-home-sticky-stage>
        <div className={styles.freightStage}>
          <p className={styles.freightWord} data-freight-word aria-hidden="true">FREIGHT</p>
          <div className={styles.networkCopy}>
            <p className={styles.eyebrow}>Freight</p>
            <h2 className={styles.heading} id="freight-heading">Built for more than small parcels.</h2>
            <p className={styles.body}>When the load gets larger, the network scales with it.</p>
          </div>
          <div className={styles.freightTruck} data-freight-truck aria-hidden="true">
            {/* Runtime actor layer carries the generated Red Truck states. */}
          </div>
          <nav className={styles.freightLinks} aria-label="KT service routes">
            {ROUTES.map(([label, href]) => <Link key={href} href={href}>{label} <span aria-hidden="true">↗</span></Link>)}
          </nav>
          <div data-freight-local-street aria-hidden="true" />
        </div>
      </div>
    </section>
  );
}
