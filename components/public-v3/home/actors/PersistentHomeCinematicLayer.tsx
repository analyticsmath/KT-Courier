"use client";

/* eslint-disable @next/next/no-img-element -- decoded local derivatives are director-owned */

import styles from "../home-cinematic.module.css";
import { BOX_PLATES, DELIVERY_PLATES, HANDOFF_PLATES, PICKUP_PLATES } from "../director/home-performance-sequences";

function VehicleStage({ kind }: { kind: "pickup" | "delivery" }) {
  return <div className={styles.vehicleStage} data-cinematic-vehicle={kind}>
    <span className={styles.vehicleShadow} />
    <img className={styles.vehiclePlate} data-vehicle-plate={kind} src={kind === "pickup" ? PICKUP_PLATES[0] : DELIVERY_PLATES[0]} alt="" />
  </div>;
}

function RouteRoad() {
  const main = "M -70 190 H 665 C 706 190 730 252 730 360 V 1080";
  const branch = "M 665 190 C 760 190 792 135 860 45 L 930 -55";
  return <svg className={styles.routeRoad} data-cinematic-road viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <defs><pattern id="road-grain" width="8" height="8" patternUnits="userSpaceOnUse"><circle cx="1" cy="2" r=".35" fill="#a6adae" opacity=".35" /><circle cx="6" cy="5" r=".35" fill="#a6adae" opacity=".35" /></pattern></defs>
    <rect width="1000" height="1000" fill="#dfe3e3" />
    <path d={main} fill="none" stroke="#b7bfc0" strokeWidth="138" strokeLinejoin="round" />
    <path d={branch} fill="none" stroke="#b7bfc0" strokeWidth="118" strokeLinejoin="round" />
    <path d={main} fill="none" stroke="#454c4d" strokeWidth="116" strokeLinejoin="round" />
    <path d={branch} fill="none" stroke="#454c4d" strokeWidth="96" strokeLinejoin="round" />
    <path d={main} fill="none" stroke="url(#road-grain)" strokeWidth="116" strokeLinejoin="round" />
    <path d={branch} fill="none" stroke="url(#road-grain)" strokeWidth="96" strokeLinejoin="round" />
  </svg>;
}

/** One post-Hero stage; every physical object keeps its own transform. */
export function PersistentHomeCinematicLayer() {
  return <div className={styles.persistentActors} data-home-cinematic-layer aria-hidden="true">
    <div className={styles.mechanicalBox} data-cinematic-box><img data-box-plate src={BOX_PLATES[0]} alt="" /></div>
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
    <div className={styles.handoffStage} data-cinematic-handoff><img data-handoff-plate src={HANDOFF_PLATES[0]} alt="" /></div>
    <div className={styles.freightTruckActor} data-cinematic-red-truck><img data-cinematic-red-truck-image alt="" /></div>
    <div className={styles.parcelBridge} data-cinematic-parcel-bridge><p>Your order</p><strong>Packed for<br />the road.</strong></div>
    <div className={styles.routeBridge} data-cinematic-route-bridge><p>On the move</p><strong>Across town.<br />On its way.</strong></div>
    <div className={styles.freightBridge} data-cinematic-freight-bridge><p>KT for business</p><strong>A bigger load.<br />The same care.</strong></div>
    <div className={styles.pickupBridge} data-cinematic-pickup-bridge>Collected.</div>
    <div className={styles.deliveryBridge} data-cinematic-delivery-bridge>Delivered.</div>
  </div>;
}
