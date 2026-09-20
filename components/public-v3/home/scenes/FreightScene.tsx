"use client";

import Link from "next/link";
import Image from "next/image";
import { ktMediaV3 } from "../../media/kt-media-v3";
import { chapterBudgetVh, mobileChapterBudgetVh } from "../director/home-chapters";
import styles from "../post-hero-scenes.module.css";

interface FreightSceneProps {
  className?: string;
}

/**
 * Chapter 09 — Freight & Heavy Haulage Climax.
 * Real warehouse, forklift, and line-haul distribution terminal photography behind
 * the dominant Red Freight Truck actor.
 * Industrial scale is communicated through physical vehicle mass.
 * Color discipline: Red is supplied exclusively by the truck body and trailer curtain.
 */
export function FreightScene({ className = "" }: FreightSceneProps) {
  const warehouseBg = ktMediaV3.pages.homepage.freightClimax.background;

  return (
    <section
      className={`${styles.freightSection} ${className}`}
      data-kt-contrast="dark"
      data-kt-scene="freight"
      data-motion="freight-world"
      aria-labelledby="freight-heading"
      style={{ "--kt-home-budget": chapterBudgetVh("freight"), "--kt-home-mobile-budget": mobileChapterBudgetVh("freight") } as React.CSSProperties}
    >
      <div className="kt-home-sticky-stage kt-home-freight-sticky">
      {/* Industrial Warehouse & Terminal Atmosphere */}
      <div className={styles.freightWarehouse}>
        <Image
          src={warehouseBg.src}
          alt={warehouseBg.alt}
          fill
          sizes="100vw"
          className="object-cover object-center filter contrast-125 brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--kt-asphalt)] via-[var(--kt-asphalt)]/70 to-[var(--kt-asphalt)]" />
      </div>

      {/* Monumental FREIGHT Typography Depth Plane behind Red Truck (Directive Items 20, 43, 61) */}
      <div
        className={styles.freightType}
        aria-hidden="true"
      >
        <span data-motion="freight-type">
          FREIGHT
        </span>
      </div>

      {/* Top Narrative Framing */}
      <div className={styles.freightHeading}>
        <h2 id="freight-heading">
          Built for more than small parcels.
        </h2>
        <p>
          Palletized cargo, line-haul corridors, and dedicated fleet capacity across South Africa.
        </p>
      </div>

      {/* Hero Actor Anchor: Centered Red Freight Truck */}
      <div data-actor-anchor="freight-truck" className={styles.freightActorPlane} />
      <div className={styles.freightServices} aria-label="Freight services">
        {["Palletized cargo", "Line-haul corridors", "Dedicated fleet", "Terminal handling"].map((service) => <div key={service}><strong>{service}</strong><span>Built into the same moving network.</span></div>)}
      </div>

      {/* Bottom Action & Scope */}
      <div className={styles.freightAction}>
        <Link
          href="/services/freight"
          className="kt-action-filled px-8 py-3.5 inline-flex items-center justify-center font-bold text-xs uppercase tracking-wider !bg-[var(--kt-freight-paper)] !text-[var(--kt-asphalt)] hover:!bg-white"
        >
          View freight &rarr;
        </Link>
      </div>
      </div>
    </section>
  );
}
