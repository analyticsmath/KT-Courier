import Image from "next/image";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

export function PreparationScene() {
  return (
    <section aria-labelledby="prep-heading" className={styles.prepScene} data-scene="preparation">
      <div className={styles.prepInner}>
        <div className={styles.prepCopyBlock} data-actor="prep-copy">
          <h2 className={styles.prepStatement} id="prep-heading">
            Someone gets it ready.
          </h2>
          <p className={styles.prepLead}>
            The merchant prepares the order. Items are packaged and staged for collection as the delivery enters the workflow.
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 16 }}>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--kt-cool-200, #eceeee)",
              }}
            >
              Order Staged for Collection
            </span>
          </div>
        </div>

        <div className={styles.prepMediaStage} data-actor="prep-stage">
          <div className={styles.prepMerchantWorld} data-actor="merchant-world">
            <Image
              alt={homeMedia.merchantPrepare.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 65vw"
              src={homeMedia.merchantPrepare.src}
              style={{ objectFit: "cover", objectPosition: homeMedia.merchantPrepare.objectPosition }}
            />
          </div>

          <div className={styles.prepDetailActor} data-actor="package-actor">
            <Image
              alt={homeMedia.packageDetail.alt}
              fill
              sizes="(max-width: 767px) 180px, 320px"
              src={homeMedia.packageDetail.src}
              style={{ objectFit: "cover", objectPosition: homeMedia.packageDetail.objectPosition }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
