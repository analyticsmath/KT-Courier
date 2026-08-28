import Image from "next/image";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

export function HandoffScene() {
  return (
    <section
      aria-labelledby="handoff-heading"
      className={styles.handoffScene}
      data-scene="handoff"
    >
      <div className={styles.handoffInner}>
        <h2 className={styles.handoffHeadline} id="handoff-heading">
          RESPONSIBILITY<br />CHANGES HANDS.
        </h2>

        <div
          className={styles.handoffTransformationFrame}
          data-actor="handoff-frame"
        >
          <Image
            alt={homeMedia.handoff.alt}
            fill
            sizes="(max-width: 1023px) 100vw, 1400px"
            src={homeMedia.handoff.src}
            style={{
              objectFit: "cover",
              objectPosition: homeMedia.handoff.objectPosition,
            }}
          />
        </div>

        <div className={styles.handoffTokenRow}>
          <span className={styles.handoffTokenText}>
            Physical custody verified · Point-to-point transit initiated
          </span>
        </div>
      </div>
    </section>
  );
}
