import Image from "next/image";
import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { homeMedia } from "./home-media";
import styles from "./home-experience.module.css";

export function NetworkCommerceField() {
  const tiles = [
    { media: homeMedia.retailLocal, title: "Local Retail", span: 1 },
    { media: homeMedia.foodLocal, title: "Food & Meals", span: 1 },
    { media: homeMedia.grocery, title: "Fresh Grocery", span: 1 },
    { media: homeMedia.wellness, title: "Wellness & Apothecary", span: 1 },
    { media: homeMedia.homeware, title: "Homeware & Design", span: 1 },
    { media: homeMedia.routeCity, title: "City Reach", span: 1 },
  ];

  return (
    <section aria-labelledby="network-title" className={styles.networkScene} data-scene="network">
      <div className={styles.networkInner}>
        <div className={styles.networkHeader}>
          <div>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--kt-red)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Stage 04 &middot; Network Breadth
            </span>
            <h2 style={{ fontSize: "var(--kt-type-major)", fontWeight: 520, letterSpacing: "-0.03em", color: "var(--kt-carbon)", marginTop: 6 }} id="network-title">
              One network. More ways to move.
            </h2>
            <p style={{ fontSize: "var(--kt-type-lead)", color: "var(--kt-cool-650)", marginTop: 8, maxWidth: 560 }}>
              Connecting independent retailers, neighborhood kitchens, essential grocers, and stores with dedicated courier delivery.
            </p>
          </div>

          <Link className={styles.heroCommandPrimary} href={marketplaceHref()}>
            Shop the marketplace <KtIconArrowRight size={18} />
          </Link>
        </div>

        <div className={styles.networkGrid}>
          {tiles.map((tile) => (
            <div className={styles.networkTile} key={tile.title}>
              <Image
                alt={tile.media.alt}
                fill
                sizes="(max-width: 600px) 100vw, (max-width: 1023px) 50vw, 33vw"
                src={tile.media.src}
                style={{ objectFit: "cover", objectPosition: tile.media.objectPosition }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  width: "100%",
                  padding: "16px 20px",
                  background: "linear-gradient(to top, rgba(16, 18, 16, 0.75) 0%, transparent 100%)",
                  color: "var(--kt-white)",
                  fontSize: "1rem",
                  fontWeight: 560,
                }}
              >
                {tile.title}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
