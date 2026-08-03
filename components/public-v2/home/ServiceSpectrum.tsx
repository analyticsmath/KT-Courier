import Image from "next/image";
import Link from "next/link";
import { NativeScroller } from "@/components/public-v2/interactions";
import { homepageMedia } from "@/lib/public-assets/homepage-media";
import styles from "./homepage-v2.module.css";

const serviceFamilies = [
  { title: "Parcels and documents", description: "For deliveries that start with a single item.", href: "/services/parcel" },
  { title: "Business and e-commerce", description: "For repeat orders and fulfilment work.", href: "/services/ecommerce" },
  { title: "Food, grocery and pharmacy", description: "For local orders that need a handoff.", href: "/services/food" },
  { title: "Moving, freight and shuttle", description: "For larger loads and transport needs.", href: "/services/freight" },
] as const;

export function ServiceSpectrum() {
  return (
    <section aria-labelledby="services-heading" className={styles.servicesSection}>
      <div className={styles.sectionInner}>
        <div className={styles.sectionHeadingRow}>
          <div>
            <p className={styles.sectionMarker}>The service spectrum</p>
            <h2 id="services-heading">One network. Many ways to move.</h2>
            <p>From a single parcel to repeat business fulfilment, KT Couriers connects the service to the people and systems behind it.</p>
          </div>
        </div>

        <NativeScroller
          alignment="center"
          className={styles.serviceScroller}
          controlsClassName={styles.serviceControls}
          id="service-spectrum-scroller"
          itemCount={serviceFamilies.length}
          label="service family"
          labelledBy="services-heading"
          progress="count"
          trackClassName={styles.serviceRail}
          viewportClassName={styles.serviceViewport}
        >
          {serviceFamilies.map((service, index) => {
            const image = homepageMedia.services[index];

            return (
              <li
                className={styles.servicePanel}
                data-native-scroller-active={index === 0 ? "true" : undefined}
                data-native-scroller-item
                key={service.href}
              >
                <Image
                  alt={image.alt}
                  fill
                  sizes="(max-width: 1023px) calc(100vw - 52px), 26vw"
                  src={image.src}
                  style={{ objectPosition: image.focalPoint }}
                />
                <div className={styles.servicePanelCopy}>
                  <p>{String(index + 1).padStart(2, "0")}</p>
                  <h3>{service.title}</h3>
                  <span>{service.description}</span>
                  <Link href={service.href}>Explore services <span aria-hidden="true">→</span></Link>
                </div>
              </li>
            );
          })}
        </NativeScroller>
      </div>
    </section>
  );
}
