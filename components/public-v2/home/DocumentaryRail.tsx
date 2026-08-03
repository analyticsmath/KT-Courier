import Image from "next/image";
import { RouteLine } from "@/components/public-v2/graphics";
import { NativeScroller } from "@/components/public-v2/interactions";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import styles from "./homepage-v2.module.css";

const captions = ["Preparation", "Driver arrival", "Pickup", "In transit", "Tracking", "Final handoff"] as const;

export function DocumentaryRail() {
  return (
    <section
      aria-labelledby="documentary-heading"
      className={styles.documentarySection}
      data-kt-motion-anchor="documentary-entry"
    >
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeadingRow}>
          <div data-kt-motion-reveal="heading">
            <p className={styles.sectionMarker}>The delivery journey</p>
            <h2 id="documentary-heading">From pickup to proof.</h2>
            <p>Every handoff becomes part of one visible delivery journey.</p>
          </div>
          <RouteLine className={styles.documentaryRoute} motionReveal="line" segment="documentary" variant="documentary" />
        </div>

        <NativeScroller
          alignment="start"
          className={styles.documentaryScroller}
          controlsClassName={styles.documentaryControls}
          id="documentary-journey-scroller"
          itemCount={homepageMedia.documentary.length}
          label="delivery journey"
          labelledBy="documentary-heading"
          progress="both"
          trackClassName={styles.documentaryRail}
          viewportClassName={styles.documentaryViewport}
        >
          {homepageMedia.documentary.map((image, index) => (
            <li
              className={`${styles.documentaryItem}${index === 3 ? ` ${styles.documentaryItemDominant}` : ""}`}
              data-native-scroller-active={index === 0 ? "true" : undefined}
              data-native-scroller-item
              key={image.id}
            >
              <div className={styles.documentaryImageFrame}>
                <Image
                  alt={image.alt}
                  fill
                  sizes="(max-width: 767px) calc(100vw - 52px), (max-width: 1100px) 52vw, 46vw"
                  src={image.src}
                  style={{ objectPosition: image.focalPoint }}
                />
              </div>
              <p>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {captions[index]}
              </p>
            </li>
          ))}
        </NativeScroller>
      </div>
    </section>
  );
}
