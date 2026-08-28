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
        <div className={styles.handoffCopyBlock} data-actor="handoff-copy">
          <h2 className={styles.handoffHeadline} id="handoff-heading">
            RESPONSIBILITY<br />CHANGES HANDS.
          </h2>
          <div className={styles.handoffTokenRow}>
            <span className={styles.handoffTokenText}>
              Physical handoff initiated · Delivery details confirmed upon dispatch
            </span>
          </div>
        </div>

        {/* Multi-slice / split vignette transformation frame */}
        <div
          className={styles.handoffTransformationFrame}
          data-actor="handoff-frame"
        >
          <div className={styles.handoffSliceStage} data-actor="handoff-slices">
            {[0, 1, 2, 3].map((sliceIdx) => (
              <div
                className={styles.handoffSlice}
                data-slice-index={sliceIdx}
                key={sliceIdx}
                style={{
                  clipPath: `inset(0% ${(3 - sliceIdx) * 25}% 0% ${sliceIdx * 25}%)`,
                }}
              >
                <Image
                  alt={homeMedia.handoff.alt}
                  fill
                  sizes="(max-width: 1023px) 100vw, 1600px"
                  src={homeMedia.handoff.src}
                  style={{
                    objectFit: "cover",
                    objectPosition: homeMedia.handoff.objectPosition,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
