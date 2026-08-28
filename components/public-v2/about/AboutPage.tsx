import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./about-page.module.css";

const ecosystemParticipants = [
  {
    title: "Customers & Senders",
    desc: "Browsing neighborhood store catalogs, purchasing local goods, and scheduling point-to-point parcel deliveries.",
    media: homeMedia.worldMarket,
  },
  {
    title: "Independent Merchants & Stores",
    desc: "Publishing verified store catalogs, preparing items for shipment, and coordinating batch dispatches.",
    media: homeMedia.merchantPrepare,
  },
  {
    title: "Authenticated Courier Network",
    desc: "Handling physical custody transfer, navigating verified regional road corridors, and ensuring arrival at doorsteps.",
    media: homeMedia.handoff,
  },
  {
    title: "Regional Communities & Hubs",
    desc: "Connecting urban corridors across Gauteng with clear tracking, transparent pricing variables, and local accountability.",
    media: homeMedia.routeCity,
  },
] as const;

export function AboutPage() {
  return (
    <article className={styles.aboutRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "About", href: "/about" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.aboutInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "About" }]}
          />
        </div>

        {/* Hero Ecosystem Narrative */}
        <section aria-labelledby="about-heading" className={styles.aboutHero}>
          <h1 className={styles.aboutTitle} id="about-heading">
            Marketplace commerce and delivery, connected in one network.
          </h1>
          <p className={styles.aboutLead}>
            KT Couriers connects local merchants, independent makers, and everyday senders with an authenticated regional delivery network across South Africa.
          </p>
        </section>

        {/* Operating Thesis */}
        <section aria-labelledby="thesis-heading" className={styles.narrativeSection}>
          <div className={styles.thesisGrid}>
            <div>
              <h2 className={styles.sectionHeading} id="thesis-heading">
                Where responsibility changes hands cleanly.
              </h2>
            </div>
            <div className={styles.thesisText}>
              <p>
                A delivery begins with a practical decision: someone buys a handcrafted good, an essential document needs to move, or a local kitchen prepares a fresh order.
              </p>
              <p>
                Rather than scattering coordination across disconnected messages and phone calls, KT Couriers provides a cohesive platform where catalog discovery, authenticated requests, and delivery coordination work together.
              </p>
            </div>
          </div>
        </section>

        {/* Ecosystem Participants Sequence */}
        <section aria-labelledby="ecosystem-heading" className={styles.ecosystemSection}>
          <h2 className={styles.sectionHeading} id="ecosystem-heading">
            The participants connected through our network.
          </h2>

          <div className={styles.participantList}>
            {ecosystemParticipants.map((participant) => (
              <div className={styles.participantRow} key={participant.title}>
                <div className={styles.participantMediaFrame}>
                  <Image
                    alt={participant.media.alt}
                    fill
                    sizes="(max-width: 767px) 100vw, 400px"
                    src={participant.media.src}
                    style={{
                      objectFit: "cover",
                      objectPosition: participant.media.objectPosition ?? "center",
                    }}
                  />
                </div>
                <div className={styles.participantBody}>
                  <h3 className={styles.participantTitle}>{participant.title}</h3>
                  <p className={styles.participantDesc}>{participant.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Pathways */}
        <section aria-labelledby="actions-heading" className={styles.actionsSection}>
          <div className={styles.actionsBox}>
            <h2 className={styles.actionsTitle} id="actions-heading">
              Ready to explore?
            </h2>
            <p className={styles.actionsSub}>
              Discover published products in the marketplace or request a dedicated courier delivery quote.
            </p>
            <div className={styles.actionButtonGroup}>
              <Link className={styles.primaryActionButton} href="/shop">
                <span>Shop marketplace</span>
                <KtIconArrowRight size={16} />
              </Link>
              <Link className={styles.secondaryActionButton} href="/account/request-delivery">
                <span>Request delivery</span>
                <KtIconArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
