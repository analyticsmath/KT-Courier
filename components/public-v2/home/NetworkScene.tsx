import Image from "next/image";
import { RouteLine } from "@/components/public-v2/graphics";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import styles from "./homepage-v2.module.css";

export function NetworkScene() {
  return (
    <section aria-labelledby="network-heading" className={styles.networkSection}>
      <div className={styles.sectionInner}>
        <div className={styles.networkHeading}>
          <p className={styles.sectionMarker}>People and network</p>
          <h2 id="network-heading">Built around the people behind every order.</h2>
          <p>Customers, stores, drivers and business operations each have a role in a delivery that moves clearly from handoff to handoff.</p>
        </div>

        <div className={styles.networkTriptych}>
          <RouteLine className={styles.networkRoute} segment="network" variant="network" />
          <figure className={styles.networkDriver}>
            <Image alt={homepageMedia.network.driver.alt} fill sizes="(max-width: 767px) 100vw, 33vw" src={homepageMedia.network.driver.src} />
            <figcaption><strong>Drivers</strong> keep the delivery moving between pickup and handoff.</figcaption>
          </figure>
          <figure className={styles.networkStore}>
            <Image alt={homepageMedia.network.store.alt} fill sizes="(max-width: 767px) 100vw, 48vw" src={homepageMedia.network.store.src} />
            <figcaption><strong>Stores</strong> prepare orders for customers and repeat delivery work.</figcaption>
          </figure>
          <figure className={styles.networkCustomer}>
            <Image alt={homepageMedia.documentary[5].alt} fill sizes="(max-width: 767px) 100vw, 25vw" src={homepageMedia.documentary[5].src} />
            <figcaption><strong>Customers</strong> receive updates through the account journey.</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
