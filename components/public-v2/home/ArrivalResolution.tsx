import Image from "next/image";
import Link from "next/link";
import { KtAnimatedSvg } from "@/components/public-v2/motion/KtAnimatedSvg";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { homeMedia } from "./home-media";
import styles from "./home-experience.module.css";

export function ArrivalResolution() {
  return (
    <section aria-labelledby="arrival-title" className={styles.arrivalScene} data-scene="arrival">
      <div className={styles.arrivalInner}>
        <div className={styles.arrivalImageWrap} data-actor="arrival-image">
          <Image
            alt={homeMedia.arrival.alt}
            fill
            sizes="(max-width: 1023px) 100vw, 50vw"
            src={homeMedia.arrival.src}
            style={{ objectFit: "cover", objectPosition: homeMedia.arrival.objectPosition }}
          />
        </div>

        <div className={styles.arrivalContent} data-actor="arrival-text">
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36 }}>
              <KtAnimatedSvg
                alt={homeMedia.motionArrival.alt}
                src={homeMedia.motionArrival.src}
              />
            </div>
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--kt-red)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Stage 05 &middot; Arrival
            </span>
          </div>

          <h2 className={styles.arrivalTitle} id="arrival-title">
            ARRIVED.
          </h2>

          <p className={styles.arrivalSubtitle}>
            The handoff is complete. From digital selection to physical arrival, responsibility changes hands cleanly.
          </p>

          <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Link className={styles.heroCommandPrimary} href="/account/request-delivery">
              Send your next delivery <KtIconArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
