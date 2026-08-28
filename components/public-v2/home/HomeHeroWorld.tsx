import Image from "next/image";
import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconArrowRight, KtIconArrowUpRight } from "@/components/public-v2/graphics/KtIcons";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

export function HomeHeroWorld() {
  return (
    <section aria-labelledby="hero-title" className={styles.heroScene} data-scene="hero">
      <div className={styles.heroEnvironment} data-actor="hero-env">
        <Image
          alt={homeMedia.worldMarket.alt}
          fill
          priority
          sizes="100vw"
          src={homeMedia.worldMarket.src}
          style={{ objectFit: "cover", objectPosition: homeMedia.worldMarket.objectPosition }}
        />
      </div>

      <div className={styles.heroEditorialPlane} data-actor="hero-plane">
        <h1 className={styles.heroHeadline} id="hero-title">
          <span>SHOP IT.</span>
          <span>SEND IT.</span>
          <span>MOVE IT.</span>
        </h1>
        <p className={styles.heroSupporting}>
          Marketplace and delivery, connected through one network.
        </p>
        <div className={styles.heroCommandStrip}>
          <Link className={styles.heroCommandPrimary} href={marketplaceHref()}>
            <span>SHOP</span>
            <KtIconArrowRight size={18} />
          </Link>
          <Link className={styles.heroCommandSecondary} href="/account/request-delivery">
            <span>SEND</span>
            <KtIconArrowUpRight size={18} />
          </Link>
        </div>
      </div>

      {/* Foreground cutout actor crossing the environmental boundary */}
      <div className={styles.heroForegroundActor} data-actor="hero-cutout">
        <Image
          alt={homeMedia.fashionCutout.alt}
          fill
          sizes="(max-width: 1023px) 0px, 440px"
          src={homeMedia.fashionCutout.src}
          style={{ objectFit: "contain", objectPosition: "bottom right" }}
        />
      </div>

      {/* Partial neighbor retail preview card */}
      <div className={styles.heroNeighborCard} data-actor="hero-neighbor">
        <Image
          alt={homeMedia.retailLocal.alt}
          fill
          sizes="220px"
          src={homeMedia.retailLocal.src}
          style={{ objectFit: "cover", objectPosition: homeMedia.retailLocal.objectPosition }}
        />
      </div>
    </section>
  );
}
