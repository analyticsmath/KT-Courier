import Image from "next/image";
import { KtAnimatedSvg } from "@/components/public-v2/motion/KtAnimatedSvg";
import { homeMedia } from "./home-media";
import styles from "./home-experience.module.css";

export function PreparationHandoffSequence() {
  return (
    <section aria-labelledby="prep-title" className={styles.prepScene} data-scene="preparation">
      <div className={styles.prepHandoffGrid}>
        <div className={styles.prepTextSide} data-actor="prep-text">
          <span className={styles.prepStepBadge}>Fulfillment</span>
          <h2 className={styles.prepHeading} id="prep-title">
            Someone gets it ready.
          </h2>
          <p className={styles.prepSubheading}>
            From order packaging and verification to secure custody transfer.
          </p>
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: "1.75rem", fontWeight: 600, color: "var(--kt-white)", letterSpacing: "-0.025em" }}>
              RESPONSIBILITY CHANGES HANDS.
            </h3>
            <p style={{ color: "var(--kt-cool-400)", fontSize: "0.95rem", marginTop: 8, lineHeight: 1.5 }}>
              Verified pickup and responsible physical handoff between merchant and courier.
            </p>
          </div>
        </div>

        <div className={styles.prepMediaSide} data-actor="prep-media">
          <div className={styles.prepPrimaryImage} data-actor="merchant-image">
            <Image
              alt={homeMedia.merchantPrepare.alt}
              fill
              sizes="(max-width: 1023px) 100vw, 50vw"
              src={homeMedia.merchantPrepare.src}
              style={{ objectFit: "cover", objectPosition: homeMedia.merchantPrepare.objectPosition }}
            />
          </div>

          <div className={styles.prepHandoffOverlay} data-actor="handoff-overlay">
            <Image
              alt={homeMedia.handoff.alt}
              fill
              sizes="(max-width: 767px) 180px, 360px"
              src={homeMedia.handoff.src}
              style={{ objectFit: "cover", objectPosition: homeMedia.handoff.objectPosition }}
            />
          </div>

          <div className={styles.prepMotionToken} data-actor="motion-token">
            <div style={{ width: 32, height: 32 }}>
              <KtAnimatedSvg
                alt={homeMedia.motionOrderState.alt}
                src={homeMedia.motionOrderState.src}
              />
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 540, color: "var(--kt-white)", letterSpacing: "0.02em" }}>
              CUSTODY TRANSFERRED
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
