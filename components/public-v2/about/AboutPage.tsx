import Image from "next/image";
import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { ktMediaV3 } from "@/components/public-v3/media/kt-media-v3";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import { FloatingImageGallery } from "./FloatingImageGallery";
import styles from "./about-page.module.css";

const networkPillars = [
  {
    category: "Makers & Merchants",
    title: "Trade begins with local preparation.",
    desc: "Independent shops, craft producers, and local suppliers prepare items for pickup and delivery.",
    media: ktMediaV3.pages.about.photoEssay[0],
  },
  {
    category: "Workshop Staging",
    title: "Careful packaging and preparation.",
    desc: "Items are packed with protective materials and prepared for courier collection.",
    media: ktMediaV3.pages.about.photoEssay[2],
  },
  {
    category: "Regional Transport",
    title: "Connecting routes across South Africa.",
    desc: "Couriers and transport operators move parcels across confirmed regional roads and urban corridors.",
    media: ktMediaV3.pages.about.photoEssay[1],
  },
  {
    category: "Doorstep Delivery",
    title: "Direct handoff at the destination.",
    desc: "Packages reach recipients directly at homes and business addresses, with clear in-person handovers upon arrival.",
    media: ktMediaV3.pages.about.photoEssay[4],
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
        {/* Narrative Intro with Inline-Image-In-Type Moment */}
        <section aria-labelledby="about-heading" className={styles.aboutHero}>
          <h1 className={styles.aboutTitle} id="about-heading">
            Commerce does not end at the checkout.{" "}
            <span className="inline-block align-middle mx-1 sm:mx-2 w-12 h-6 sm:w-20 sm:h-9 relative overflow-hidden rounded-full border border-black/15 shadow-inner">
              <Image
                src={ktMediaV3.pages.about.photoEssay[3].src}
                alt={ktMediaV3.pages.about.photoEssay[3].alt}
                fill
                sizes="80px"
                preload
                className="object-cover"
              />
            </span>{" "}
            Delivery does not start at the road. KT sits between the two.
          </h1>
          <p className={styles.aboutLead}>
            KT Couriers connects local merchant stores, independent senders, and courier operators across South African communities.
          </p>
        </section>

        {/* Human Narrative Sequence */}
        <section aria-label="Our Network" className={styles.ecosystemSequence}>
          {networkPillars.map((pillar, index) => (
            <div className={styles.ecosystemNode} key={pillar.category}>
              <div className={styles.nodeMediaFrame}>
                <Image
                  alt={pillar.media.alt}
                  fill
                  sizes="(max-width: 899px) 100vw, 50vw"
                  preload={index === 0}
                  src={pillar.media.src}
                  className="object-cover"
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

        {/* The People Behind the Network — Unboxed Editorial Portraits */}
        <section aria-label="People of KT Couriers" className="my-16 pt-12 border-t border-[var(--kt-concrete)]/40">
          <div className="max-w-2xl mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] font-semibold block mb-2">
              People behind the journey
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-[var(--kt-asphalt)]">
              The people who build and move the network.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:divide-x md:divide-[var(--kt-concrete)]/40">
            <div className="space-y-4 md:pr-6">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/30">
                <Image
                  src={ktMediaV3.pages.about.portraits[0].src}
                  alt={ktMediaV3.pages.about.portraits[0].alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <div className="pt-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--kt-road-grey)] block">
                  Local Merchants
                </span>
                <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)] mt-1">
                  Artisans & Independent Shops
                </h3>
                <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mt-2">
                  From neighborhood craft markets to established boutiques, independent South African merchants rely on KT for dependable fulfillment.
                </p>
              </div>
            </div>

            <div className="space-y-4 md:pl-6">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--kt-concrete)]/20 border border-[var(--kt-concrete)]/30">
                <Image
                  src={ktMediaV3.pages.about.portraits[1].src}
                  alt={ktMediaV3.pages.about.portraits[1].alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 45vw"
                  className="object-cover"
                />
              </div>
              <div className="pt-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--kt-road-grey)] block">
                  Couriers & Drivers
                </span>
                <h3 className="font-display text-xl font-bold text-[var(--kt-asphalt)] mt-1">
                  Delivery & Route Operators
                </h3>
                <p className="text-sm text-[var(--kt-road-grey)] leading-relaxed mt-2">
                  Operating across urban corridors and regional roads, bringing packages safely to their destinations.
                </p>
              </div>
            </div>
          </div>
        </section>

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
