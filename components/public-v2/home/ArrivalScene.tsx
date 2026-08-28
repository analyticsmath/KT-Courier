import Image from "next/image";
import { homeMedia } from "./home-media";
import styles from "./home-journey.module.css";

export function ArrivalScene() {
  return (
    <section
      aria-labelledby="arrival-heading"
      className={styles.arrivalScene}
      data-scene="arrival"
    >
      <div className={styles.arrivalInner}>
        <div className={styles.arrivalMediaFrame} data-actor="arrival-media">
          <Image
            alt={homeMedia.arrival.alt}
            fill
            sizes="(max-width: 899px) 100vw, 55vw"
            src={homeMedia.arrival.src}
            style={{
              objectFit: "cover",
              objectPosition: homeMedia.arrival.objectPosition,
            }}
          />
        </div>

        <div className={styles.arrivalContent} data-actor="arrival-copy">
          <h2 className={styles.arrivalHeading} id="arrival-heading">
            ARRIVED.
          </h2>
          <p className={styles.arrivalLead}>
            The handoff is complete. From digital selection to physical arrival, responsibility changes hands cleanly through the network.
          </p>
        </div>
      </div>
    </section>
  );
}
