import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./about-page.module.css";

const ecosystemStages = [
  {
    step: "01",
    role: "The Customer",
    title: "A choice is made.",
    desc: "A customer discovers handcrafted goods from a local maker or needs an essential document moved across the city.",
    media: homeMedia.worldMarket,
  },
  {
    step: "02",
    role: "The Merchant",
    title: "The item is prepared.",
    desc: "The local store prepares, packages, and stages the order for courier collection.",
    media: homeMedia.merchantPrepare,
  },
  {
    step: "03",
    role: "The Marketplace",
    title: "Coordination occurs.",
    desc: "Order records, delivery requests, and merchant catalogs connect through the central system.",
    media: homeMedia.retailLocal,
  },
  {
    step: "04",
    role: "Movement",
    title: "The route is navigated.",
    desc: "Couriers navigate regional corridors between verified collection and delivery coordinates.",
    media: homeMedia.routeRoad,
  },
  {
    step: "05",
    role: "The Recipient",
    title: "The handoff resolves.",
    desc: "Responsibility changes hands cleanly at the recipient's doorstep.",
    media: homeMedia.arrival,
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

        {/* Narrative Intro */}
        <section aria-labelledby="about-heading" className={styles.aboutHero}>
          <h1 className={styles.aboutTitle} id="about-heading">
            How commerce and delivery connect.
          </h1>
          <p className={styles.aboutLead}>
            KT Couriers provides a platform connecting local merchants, independent senders, and courier transit.
          </p>
        </section>

        {/* Continuous Ecosystem Sequence */}
        <section aria-label="Ecosystem Sequence" className={styles.ecosystemSequence}>
          {ecosystemStages.map((stage) => (
            <div className={styles.ecosystemNode} key={stage.step}>
              <div className={styles.nodeMediaFrame}>
                <Image
                  alt={stage.media.alt}
                  fill
                  sizes="(max-width: 899px) 100vw, 50vw"
                  src={stage.media.src}
                  style={{
                    objectFit: "cover",
                    objectPosition: stage.media.objectPosition ?? "center",
                  }}
                />
              </div>

              <div className={styles.nodeCopyPlane}>
                <span className={styles.nodeStepIndex}>{stage.step} · {stage.role}</span>
                <h2 className={styles.nodeTitle}>{stage.title}</h2>
                <p className={styles.nodeDesc}>{stage.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Direct Pathway Links */}
        <div className={styles.pathwayRow}>
          <Link className={styles.pathwayLink} href="/shop">
            <span>Explore Marketplace Catalog</span>
            <KtIconArrowRight size={18} />
          </Link>
          <Link className={styles.pathwayLink} href="/services">
            <span>Explore Movement Atlas</span>
            <KtIconArrowRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
