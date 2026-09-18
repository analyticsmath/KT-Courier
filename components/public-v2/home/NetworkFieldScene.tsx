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
            href={getHref("/fashion")}
          >
            <Image
              alt={homeMedia.fashion.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 48vw"
              src={homeMedia.fashion.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.fashion.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Fashion & Curated Accessories</span>
          </Link>

          {/* Narrow portrait strip */}
          <Link
            className={styles.networkTileStrip}
            href={getHref("/homeware")}
          >
            <Image
              alt={homeMedia.homeware.alt}
              fill
              sizes="(max-width: 1023px) 50vw, 22vw"
              src={homeMedia.homeware.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.homeware.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Artisan Homeware</span>
          </Link>

          {/* Tactile aperture */}
          <Link
            className={styles.networkTileAperture}
            href={getHref("/retail")}
          >
            <Image
              alt={homeMedia.packageDetail.alt}
              fill
              sizes="(max-width: 1023px) 50vw, 30vw"
              src={homeMedia.packageDetail.src}
              style={{
                objectFit: "cover",
                objectPosition: homeMedia.packageDetail.objectPosition,
              }}
            />
            <span className={styles.networkTileLabel}>Handcrafted Packaging</span>
          </Link>

          {/* Landscape support frame */}
          <Link
            className={styles.networkTileSupport}
            href="/join"
          >
            <Image
              alt="Local South African merchant in workshop"
              fill
              sizes="(max-width: 1023px) 100vw, 30vw"
              src="/media/public/auth/kt-auth-02-merchant.webp"
              style={{
                objectFit: "cover",
                objectPosition: "50% 30%",
              }}
            />
            <span className={styles.networkTileLabel}>Maker Community</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
