"use client";

/* eslint-disable @next/next/no-img-element -- decoded local derivatives are director-owned */

import styles from "../home-cinematic.module.css";

function VehicleStage({ kind }: { kind: "pickup" | "delivery" }) {
  return <div className={styles.vehicleStage} data-cinematic-vehicle={kind}>
    <span className={styles.vehicleShadow} />
    <img className={styles.vehicleBody} data-vehicle-base={kind} alt="" />
    <img className={styles.vehicleDoor} data-vehicle-door={kind} alt="" />
    <img className={styles.vehicleBodyForeground} data-vehicle-foreground={kind} alt="" />
    <div className={styles.vehicleCargoMask} data-vehicle-cargo-mask={kind} />
    <img className={styles.vehicleCourier} data-vehicle-courier={kind} alt="" />
  </div>;
}

function RouteRoad() {
  const main = "M -70 190 H 665 C 706 190 730 252 730 360 V 1080";
  const branch = "M 665 190 C 760 190 792 135 860 45 L 930 -55";
  return <svg className={styles.routeRoad} data-cinematic-road viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <rect width="1000" height="1000" fill="#e9ece9" />
    <path d={main} fill="none" stroke="#cbd1cc" strokeWidth="132" strokeLinejoin="round" />
    <path d={branch} fill="none" stroke="#cbd1cc" strokeWidth="112" strokeLinejoin="round" />
    <path d={main} fill="none" stroke="#363e42" strokeWidth="112" strokeLinejoin="round" />
    <path d={branch} fill="none" stroke="#3d4549" strokeWidth="92" strokeLinejoin="round" />
    <path d={main} fill="none" stroke="#edf0e9" strokeWidth="2" strokeDasharray="14 18" />
    <path d={branch} fill="none" stroke="#edf0e9" strokeWidth="2" strokeDasharray="14 18" />
  </svg>;
}

/** One post-Hero stage; every physical object keeps its own transform. */
export function PersistentHomeCinematicLayer() {
  return <div className={styles.persistentActors} data-home-cinematic-layer aria-hidden="true">
    <div className={styles.mechanicalBox} data-cinematic-box>
      <span className={styles.boxShadow} />
      <span className={styles.boxRearWall} />
      <span className={styles.boxInterior} />
      <span className={styles.boxLeftWall} />
      <span className={styles.boxRightWall} />
      <span className={styles.boxFrontWall} />
      <span className={`${styles.boxFlap} ${styles.boxFlapRear}`} data-box-flap="rear" />
      <span className={`${styles.boxFlap} ${styles.boxFlapLeft}`} data-box-flap="left" />
      <span className={`${styles.boxFlap} ${styles.boxFlapRight}`} data-box-flap="right" />
      <span className={`${styles.boxFlap} ${styles.boxFlapFront}`} data-box-flap="front" />
    </div>
    <VehicleStage kind="pickup" />
    <div className={styles.routeCamera} data-cinematic-route-camera>
      <div className={styles.routeWorld} data-cinematic-route-world>
        <RouteRoad />
        <div className={styles.routeVan} data-cinematic-route-van>
          <img data-cinematic-route-van-lower alt="" />
          <img data-cinematic-route-van-upper alt="" />
        </div>
      </div>
    </div>
    <VehicleStage kind="delivery" />
    <img className={styles.recipientActor} data-cinematic-recipient alt="" />
    <div className={styles.parcelActor} data-cinematic-parcel />
    <div className={styles.freightTruckActor} data-cinematic-red-truck><img data-cinematic-red-truck-image alt="" /></div>
  </div>;
}
