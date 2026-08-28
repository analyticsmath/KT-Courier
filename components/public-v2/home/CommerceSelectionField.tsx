import Image from "next/image";
import Link from "next/link";
import { marketplaceHref } from "@/lib/public-marketplace/routes";
import { homeMedia } from "./home-media";
import styles from "./home-experience.module.css";

const categories = [
  { id: "fashion", name: "Fashion & Lifestyle", tag: "Editorial", media: homeMedia.fashion },
  { id: "food", name: "Local Food & Kitchens", tag: "Prepared", media: homeMedia.foodLocal },
  { id: "grocery", name: "Fresh Market Grocery", tag: "Daily Produce", media: homeMedia.grocery },
  { id: "retail", name: "Local Retail & Crafts", tag: "Handmade", media: homeMedia.retailLocal },
  { id: "wellness", name: "Wellness & Self-Care", tag: "Apothecary", media: homeMedia.wellness },
  { id: "homeware", name: "Homeware & Ceramics", tag: "Living", media: homeMedia.homeware },
];

export function CommerceSelectionField() {
  return (
    <section aria-labelledby="selection-title" className={styles.selectionScene} data-scene="selection">
      <div className={styles.selectionStickyContainer}>
        <div className={styles.selectionHeader}>
          <div>
            <h2 className={styles.selectionTitle} id="selection-title">
              It starts with a choice.
            </h2>
            <p className={styles.selectionSubtitle}>
              Discover independent makers, local merchants, and neighborhood essentials.
            </p>
          </div>
          <Link className={styles.heroCommandSecondary} href={marketplaceHref()}>
            Browse all categories &rarr;
          </Link>
        </div>

        <div className={styles.selectionTrack} data-actor="selection-track">
          {categories.map((cat) => (
            <Link
              className={styles.categoryCard}
              data-category-card={cat.id}
              href={`${marketplaceHref()}?category=${cat.id}`}
              key={cat.id}
            >
              <div className={styles.categoryImageWrap}>
                <Image
                  alt={cat.media.alt}
                  fill
                  sizes="(max-width: 767px) 85vw, 400px"
                  src={cat.media.src}
                  style={{ objectFit: "cover", objectPosition: cat.media.objectPosition }}
                />
              </div>
              <div className={styles.categoryMeta}>
                <span className={styles.categoryName}>{cat.name}</span>
                <span className={styles.categoryTag}>{cat.tag}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
