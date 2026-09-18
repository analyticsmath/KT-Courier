import Image from "next/image";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { PublicButton, RouteMeta, EditorialLabel } from "@/components/public-v2/primitives";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

export function HomeHeroWorld() {
  return (
    <section aria-labelledby="hero-title" className={styles.heroScene} data-kt-contrast="dark" data-scene="hero">
      {/* Back Plane: Environmental Media & Watermark */}
      <div className={styles.heroEnvironment} data-actor="hero-env">
        <Image
          alt={homeMedia.worldMarket.alt}
          fill
          priority
          sizes="100vw"
          src={homeMedia.worldMarket.src}
          style={{ objectFit: "cover", objectPosition: homeMedia.worldMarket.objectPosition }}
        />
        <div className={styles.heroEnvironmentScrim} />
      </div>

      <div className={styles.heroContainer}>
        {/* Middle Plane: Editorial Narrative & Action Hub */}
        <div className={styles.heroEditorialPlane} data-actor="hero-plane">
          <div className={styles.heroMetaRow}>
            <EditorialLabel variant="badgeDark">EST. SOUTH AFRICA</EditorialLabel>
            <RouteMeta routeCode="JHB-CENTRAL-01" status="ACTIVE" />
          </div>

          <h1 className={styles.heroHeadline} id="hero-title">
            <span>SOUTH AFRICAN</span>
            <span className={styles.heroHeadlineAccent}>COMMERCE</span>
            <span>IN MOTION.</span>
          </h1>

          <p className={styles.heroSupporting}>
            From neighborhood makers and market stalls to dedicated courier corridors across
            Johannesburg, Cape Town, and Durban. Two sides of one moving system.
          </p>

          <div className={styles.heroCommandStrip}>
            <PublicButton arrow href={marketplaceHref()} size="lg" variant="signal">
              SHOP LOCAL MAKERS
            </PublicButton>
            <PublicButton arrow href="/services/pricing" size="lg" variant="secondary">
              CALCULATE DELIVERY
            </PublicButton>
          </div>

          <div className={styles.heroOperationalProof}>
            <span className={styles.heroProofItem}>ZAR Settled</span>
            <span className={styles.heroProofDot}>·</span>
            <span className={styles.heroProofItem}>Verified OTP Handoff</span>
            <span className={styles.heroProofDot}>·</span>
            <span className={styles.heroProofItem}>11 Active Service Corridors</span>
          </div>
        </div>

        {/* Front Plane: Flagship Long White Truck Protagonist Occluding Typography */}
        <div className={styles.heroTruckStage} data-actor="hero-cutout">
          <div className={styles.heroTruckWrapper}>
            <Image
              alt={homeMedia.heroTruck.alt}
              fill
              priority
              sizes="(max-width: 767px) 100vw, (max-width: 1440px) 55vw, 760px"
              src={homeMedia.heroTruck.src}
              style={{ objectFit: "contain", objectPosition: "bottom right" }}
            />
          </div>
          <div className={styles.heroTruckTelemetry}>
            <span className={styles.heroTruckDot} />
            <span>FLEET PROTAGONIST · LONG-HAUL CARGO #01</span>
          </div>
        </div>
      </div>
    </section>
  );
}
