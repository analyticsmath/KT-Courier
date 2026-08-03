import Image from "next/image";
import Link from "next/link";
import { RouteLine } from "@/components/public-v2/graphics";
import { EditorialMediaFrame } from "@/components/public-v2/media";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import { anonymousTracking } from "@/components/public-v2/site/tracking-copy";
import styles from "./homepage-v2.module.css";

export function ClosingScene() {
  return (
    <section aria-labelledby="closing-heading" className={styles.closingSection}>
      <div className={styles.sectionInner}>
        <div className={styles.closingCopy}>
          <p className={styles.sectionMarker}>Start here</p>
          <h2 id="closing-heading">Ready when you are.</h2>
          <div className={styles.closingActions}>
            <Link className={styles.commandPrimary} href="/account/request-delivery">Get a quote <span aria-hidden="true">→</span></Link>
            <Link className={styles.textAction} href={anonymousTracking.href}>{anonymousTracking.actionLabel} <span aria-hidden="true">→</span></Link>
            <Link className={styles.textAction} href="/contact">Contact support <span aria-hidden="true">→</span></Link>
          </div>
        </div>
        <EditorialMediaFrame className={styles.closingDetail} mediaClassName={styles.closingDetailMedia} variant="detail">
          <RouteLine className={styles.closingRoute} segment="closing" variant="closing" />
          <Image alt={homepageMedia.hero.parcelDetail.alt} fill sizes="(max-width: 767px) 100vw, 35vw" src={homepageMedia.hero.parcelDetail.src} />
        </EditorialMediaFrame>
      </div>
    </section>
  );
}
