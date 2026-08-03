import Image from "next/image";
import Link from "next/link";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import styles from "./homepage-v2.module.css";

const deliveryStates = ["Request received", "Pickup scheduled", "Picked up", "In transit", "Delivered"] as const;

export function OperationalControlScene() {
  return (
    <section aria-labelledby="control-heading" className={styles.controlSection}>
      <div className={styles.sectionInner}>
        <div className={styles.controlHeading}>
          <p className={styles.sectionMarker}>Operational control</p>
          <h2 id="control-heading">Control at every checkpoint.</h2>
          <p>This is an explanation of the delivery journey. It is not a live customer order.</p>
        </div>

        <div className={styles.controlBody}>
          <ol aria-label="Delivery status sequence" className={styles.stateSequence}>
            {deliveryStates.map((state, index) => (
              <li key={state}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {state}
              </li>
            ))}
          </ol>
          <div className={styles.controlDetail}>
            <Image alt={homepageMedia.documentary[4].alt} fill sizes="(max-width: 767px) 100vw, 32vw" src={homepageMedia.documentary[4].src} />
            <Link href="/account/orders">Track a delivery <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
