"use client";

/* eslint-disable @next/next/no-img-element -- generated WebPs are pre-sized and src is advanced after decode */

import styles from "../home-cinematic.module.css";

/** One persistent stage holds the physical actors across chapter boundaries. */
export function PersistentHomeCinematicLayer() {
  return <div className={styles.persistentActors} data-home-cinematic-layer aria-hidden="true">
    <div className={styles.boxActor} data-cinematic-box><img data-cinematic-box-image alt="" /></div>
    <div className={styles.boxForeground} data-cinematic-box-foreground><img data-cinematic-box-foreground-image alt="" /></div>
    <div className={styles.performanceActor} data-cinematic-pickup><img data-cinematic-pickup-image alt="" /></div>
    <div className={styles.routeCamera} data-cinematic-route-camera>
      <div className={styles.routeWorld} data-cinematic-route-world>
        <img className={styles.routeRoad} data-cinematic-road alt="" />
        <div className={styles.routeVan} data-cinematic-route-van><img data-cinematic-route-van-image alt="" /></div>
      </div>
    </div>
    <div className={styles.performanceActor} data-cinematic-delivery><img data-cinematic-delivery-image alt="" /></div>
    <div className={styles.handoffActor} data-cinematic-handoff><img data-cinematic-handoff-image alt="" /></div>
    <div className={styles.freightTruckActor} data-cinematic-red-truck><img data-cinematic-red-truck-image alt="" /></div>
  </div>;
}
