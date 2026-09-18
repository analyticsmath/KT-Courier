import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { homeMedia } from "@/components/public-v2/home/home-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { FloatingImageGallery } from "./FloatingImageGallery";
import styles from "./about-page.module.css";

const networkPillars = [
  {
    category: "Makers & Merchants",
    title: "Trade begins with local preparation.",
    desc: "Independent shops, craft producers, and regional suppliers prepare products with care before handover.",
    media: homeMedia.merchantPrepare,
  },
  {
    category: "Marketplace Continuity",
    title: "Catalog diversity connects with real delivery.",
    desc: "From everyday essentials to specialty items, every listing is backed by confirmed courier routes.",
    media: homeMedia.retailLocal,
  },
  {
    category: "Regional Transport",
    title: "Connecting routes across South Africa.",
    desc: "Couriers and freight operators navigate provincial corridors and urban streets with verified custody.",
    media: homeMedia.routeRoad,
  },
  {
    category: "Doorstep Delivery",
    title: "Clean, verified handoff at the destination.",
    desc: "Packages reach recipients directly at homes, offices, and regional collection points on schedule.",
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
            Commerce does not end at the checkout. Delivery does not start at the road. KT sits between the two.
          </h1>
          <p className={styles.aboutLead}>
            KT Couriers connects local merchant stores, independent senders, and trusted couriers across South African communities.
          </p>
        </section>

        {/* Human Narrative Sequence */}
        <section aria-label="Our Network" className={styles.ecosystemSequence}>
          {networkPillars.map((pillar) => (
            <div className={styles.ecosystemNode} key={pillar.category}>
              <div className={styles.nodeMediaFrame}>
                <Image
                  alt={pillar.media.alt}
                  fill
                  sizes="(max-width: 899px) 100vw, 50vw"
                  src={pillar.media.src}
                  style={{
                    objectFit: "cover",
                    objectPosition: pillar.media.objectPosition ?? "center",
                  }}
                />
              </div>

              <div className={styles.nodeCopyPlane}>
                <span className={styles.nodeStepIndex}>{pillar.category}</span>
                <h2 className={styles.nodeTitle}>{pillar.title}</h2>
                <p className={styles.nodeDesc}>{pillar.desc}</p>
              </div>
            </div>
          ))}
        </section>

        {/* Floating Asymmetrical Gallery */}
        <FloatingImageGallery />

        {/* Direct Pathway Links */}
        <div className={styles.pathwayRow}>
          <Link className={styles.pathwayLink} href="/shop">
            <span>Explore Marketplace</span>
            <KtIconArrowRight size={18} />
          </Link>
          <Link className={styles.pathwayLink} href="/services">
            <span>Explore Delivery Services</span>
            <KtIconArrowRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  );
}
