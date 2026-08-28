import Image from "next/image";
import Link from "next/link";
import { marketplaceHref, marketplaceCategoryHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

interface NetworkFieldSceneProps {
  categories?: readonly { path: string; name: string }[];
}

export function NetworkFieldScene({ categories = [] }: NetworkFieldSceneProps) {
  const catMap = new Map(categories.map((c) => [c.path.toLowerCase(), c.path]));

  const getHref = (defaultPath: string) => {
    const matched = catMap.get(defaultPath.toLowerCase());
    return matched ? marketplaceCategoryHref(matched) || marketplaceHref() : marketplaceHref();
  };

  return (
    <section
      aria-labelledby="network-heading"
      className={styles.networkScene}
      data-scene="network"
    >
      <div className={styles.networkInner}>
        <div className={styles.networkHeader}>
          <div>
            <h2 className={styles.networkTitle} id="network-heading">
              One network. More ways to move.
            </h2>
            <p className={styles.networkSub}>
              Connecting independent retailers, neighborhood kitchens, local grocers, and commercial senders with dedicated courier delivery.
            </p>
          </div>

          <Link className={styles.heroCommandPrimary} href={marketplaceHref()}>
            Shop the marketplace &rarr;
          </Link>
        </div>

        <div className={styles.networkFieldAsymmetric} data-actor="network-field">
          {/* Large active category tile */}
          <Link
            className={styles.networkTileLarge}
            href={getHref("/retail")}
          >
            <Image
              alt={homeMedia.retailLocal.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 48vw"
              src={homeMedia.retailLocal.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.retailLocal.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Local Retail & Crafts</span>
          </Link>

          {/* Narrow portrait strip */}
          <Link
            className={styles.networkTileStrip}
            href={getHref("/food")}
          >
            <Image
              alt={homeMedia.foodLocal.alt}
              fill
              sizes="(max-width: 1023px) 50vw, 22vw"
              src={homeMedia.foodLocal.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.foodLocal.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Food & Kitchens</span>
          </Link>

          {/* Tactile aperture */}
          <Link
            className={styles.networkTileAperture}
            href={getHref("/wellness")}
          >
            <Image
              alt={homeMedia.wellness.alt}
              fill
              sizes="(max-width: 1023px) 50vw, 30vw"
              src={homeMedia.wellness.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.wellness.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Wellness & Care</span>
          </Link>

          {/* Landscape support frame */}
          <Link
            className={styles.networkTileSupport}
            href={getHref("/grocery")}
          >
            <Image
              alt={homeMedia.grocery.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 30vw"
              src={homeMedia.grocery.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.grocery.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Fresh Grocery</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
