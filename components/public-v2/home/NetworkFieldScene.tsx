"use client";

import Image from "next/image";
import Link from "next/link";
import { ktMedia } from "@/components/public-v2/media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./home-journey.module.css";

export function NetworkFieldScene() {
  const whiteTruck = ktMedia.home.heroTruck.centeredHero;
  const redTruck = ktMedia.home.redTruck.sideRight;

  return (
    <section
      aria-labelledby="network-scale-heading"
      className={styles.networkScaleScene}
      data-scene="network"
    >
      <div className={styles.networkScaleContainer}>
        {/* Editorial Heading */}
        <div className={styles.networkScaleHeader} data-actor="network-header">
          <span className={styles.networkScaleChapterTag}>
            STATE 12 — NETWORK SCALE
          </span>
          <h2 className={styles.networkScaleTitle} id="network-scale-heading">
            Corridors Scale Up
          </h2>
          <p className={styles.networkScaleLead}>
            Flagship freight capacity connects regional distribution centers. When volume demands surge, heavy transport enters the line.
          </p>
        </div>

        {/* Dual Protagonist Stage: Long White Truck Flagship Callback + Rare Red Truck Freight Escalation */}
        <div className={styles.networkFleetDualStage} data-actor="network-field">
          {/* Flagship Long White Truck Callback */}
          <div className={styles.fleetWhiteTruckCard} data-actor="network-tile">
            <div className={styles.fleetTruckMediaFrame}>
              <Image
                alt={whiteTruck.alt}
                src={whiteTruck.src}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
            <div className={styles.fleetTruckMetaBar}>
              <span className="text-[10px] font-mono tracking-widest text-[#347CFB] uppercase font-bold">
                FLAGSHIP LONG-HAUL
              </span>
              <span className="text-sm font-semibold text-[#111318]">
                Daily Linehaul Transit
              </span>
            </div>
          </div>

          {/* Heavy Logistics Red Truck (Freight & Capacity Escalation) */}
          <div className={styles.fleetRedTruckCard} data-actor="network-tile">
            <div className={styles.fleetTruckMediaFrame}>
              <Image
                alt={redTruck.alt}
                src={redTruck.src}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 50vw"
                className="object-contain"
              />
            </div>
            <div className={styles.fleetTruckMetaBar}>
              <span className="text-[10px] font-mono tracking-widest text-[#CF2930] uppercase font-bold">
                HEAVY FREIGHT ESCALATION
              </span>
              <span className="text-sm font-semibold text-[#111318]">
                Curtainside Pallet Cargo
              </span>
            </div>
          </div>
        </div>

        {/* Subordinate Movement Atlas Pathway */}
        <div className={styles.networkSubordinateRow}>
          <Link
            href="/services/freight"
            className={styles.networkFreightAction}
            data-kt-sticky-mode="FREIGHT"
          >
            <span>Explore Heavy Freight Services</span>
            <KtIconArrowRight size={16} />
          </Link>
          <Link
            href="/services"
            className={styles.networkAtlasAction}
            data-kt-sticky-mode="ATLAS"
          >
            <span>Full Movement Atlas</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
