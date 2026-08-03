import { RouteLine } from "@/components/public-v2/graphics";
import { ArtDirectedImage, EditorialMediaFrame } from "@/components/public-v2/media";
import { EditorialGrid, PublicContainer, PublicSection } from "@/components/public-v2/foundation";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import { HeroCommandDock } from "./HeroCommandDock";
import styles from "./homepage-v2.module.css";

export function HeroScene() {
  const { environment, vehicle } = homepageMedia.hero;

  return (
    <PublicSection
      aria-labelledby="homepage-hero-heading"
      className={styles.heroSection}
      data-kt-motion-scene="hero"
      data-kt-motion-anchor="hero-exit"
      tone="primary"
      variant="fullBleed"
    >
      <PublicContainer className={styles.heroContainer} variant="content">
        <EditorialGrid className={styles.heroGrid} data-kt-motion-pin="hero-stage">
          <span aria-hidden="true" className={styles.heroStartAnchor} data-kt-motion-anchor="hero-start" />
          <div className={styles.heroCopy}>
            <div data-kt-motion-layer="copy">
              <p className={styles.eyebrow}>Courier delivery, fulfilment and tracking</p>
              <h1 id="homepage-hero-heading">
                Move what <em>matters.</em>
              </h1>
              <p className={styles.heroSummary}>
                Courier delivery and logistics for customers, stores and businesses, connected through one South African platform.
              </p>
              <p className={styles.heroContext}>South Africa · local service areas</p>
            </div>
            <HeroCommandDock />
          </div>

          <div className={styles.heroEnvironment} data-kt-motion-layer="environment">
            <ArtDirectedImage
              decorative
              desktopSrc={environment.desktop!.src}
              height={environment.desktop!.height}
              mobileSrc={environment.mobile!.src}
              sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) 56vw, 52vw"
              tabletSrc={environment.tablet!.src}
              width={environment.desktop!.width}
            />
          </div>

          <RouteLine className={styles.heroRoute} segment="hero" variant="hero" />

          <span aria-hidden="true" className={styles.heroTruckShadow} data-kt-motion-layer="truck-shadow" />
          <EditorialMediaFrame
            className={styles.heroTruck}
            mediaClassName={styles.heroTruckMedia}
            motionLayer="truck"
            variant="landscape"
          >
            <ArtDirectedImage
              alt={vehicle.alt}
              desktopSrc={vehicle.desktop!.src}
              height={vehicle.desktop!.height}
              mobileSrc={vehicle.mobile!.src}
              priority={vehicle.priority}
              sizes="(max-width: 639px) min(88vw, 470px), (max-width: 1023px) 48vw, min(51vw, 760px)"
              tabletSrc={vehicle.tablet!.src}
              width={vehicle.desktop!.width}
            />
          </EditorialMediaFrame>
        </EditorialGrid>
        <span className={styles.heroContinuation} aria-hidden="true" data-kt-motion-handoff>Scroll to follow the journey</span>
      </PublicContainer>
    </PublicSection>
  );
}
