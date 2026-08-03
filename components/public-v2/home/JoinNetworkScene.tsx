import Image from "next/image";
import Link from "next/link";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import styles from "./homepage-v2.module.css";

export function JoinNetworkScene() {
  return (
    <section aria-labelledby="join-network-heading" className={styles.joinSection}>
      <div className={styles.sectionInner}>
        <div className={styles.joinHeading}>
          <p className={styles.sectionMarker}>Join the network</p>
          <h2 id="join-network-heading">Join the network that keeps orders moving.</h2>
        </div>
        <div className={styles.joinGrid}>
          <figure className={styles.joinDriverImage}>
            <Image alt={homepageMedia.network.driver.alt} fill sizes="(max-width: 767px) 100vw, 48vw" src={homepageMedia.network.driver.src} />
          </figure>
          <div className={styles.joinPathway}>
            <h3>Drivers</h3>
            <p>Explore the courier driver network and its application pathway.</p>
            <Link href="/services/driver-network">Driver network <span aria-hidden="true">→</span></Link>
          </div>
          <figure className={styles.joinStoreImage}>
            <Image alt={homepageMedia.network.store.alt} fill sizes="(max-width: 767px) 100vw, 33vw" src={homepageMedia.network.store.src} />
          </figure>
          <div className={styles.joinPathway}>
            <h3>Stores</h3>
            <p>Open a store account for repeat delivery and fulfilment work.</p>
            <Link href="/signup?type=store">Store account <span aria-hidden="true">→</span></Link>
          </div>
          <div className={styles.joinPathway}>
            <h3>Promoters</h3>
            <p>Contact the team to ask about promoter participation.</p>
            <Link href="/contact">Contact support <span aria-hidden="true">→</span></Link>
          </div>
          <div className={styles.joinPathway}>
            <h3>Careers</h3>
            <p>See current opportunities and application information.</p>
            <Link href="/careers">View careers <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}
