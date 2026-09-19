import Image from "next/image";
import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./membership-page.module.css";

export function MembershipPage() {
  const media = getSupportingPageMedia("membership-planning");

  return (
    <article className={styles.membershipRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Membership", href: "/membership" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.membershipInner}>
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
          >
            ← Home
          </Link>
        </div>

        <section aria-labelledby="membership-title" className={styles.membershipHero}>
          <h1 className={styles.membershipTitle} id="membership-title">
            Account & Membership Information.
          </h1>
          <p className={styles.membershipLead}>
            Information only. KT Couriers provides dedicated account access for frequent senders and merchant storefronts. No public plan activation or purchase route is offered.
          </p>
        </section>

        <section aria-labelledby="status-heading" className={styles.statusSection}>
          <div className={styles.statusLayout}>
            <div className={styles.statusCopy}>
              <h2 className={styles.statusHeading} id="status-heading">
                Current Operational Availability
              </h2>
              <p className={styles.statusText}>
                Delivery requests operate through standard authenticated customer and business accounts without requiring a recurring membership subscription.
              </p>
              <p className={styles.statusText}>
                Information only: when membership tiers or commercial volume programs are formally published, their terms, billing cycles, and feature sets will appear directly in this section. No public plan activation or purchase route is offered on this surface.
              </p>

              <div className={styles.actionRow}>
                <Link className={styles.primaryAction} href="/services/pricing">
                  <span>View Delivery Pricing Factors</span>
                  <KtIconArrowRight size={16} />
                </Link>
                <Link className={styles.secondaryAction} href="/contact">
                  <span>Contact Team</span>
                </Link>
              </div>
            </div>

            <div className={styles.statusMediaFrame}>
              <Image
                alt={media.alt}
                fill
                priority
                sizes="(max-width: 1023px) 100vw, 45vw"
                src={media.src}
                style={{ objectFit: "cover" }}
              />
            </div>
          </div>
        </section>

        {/* Stepped Editorial Sequence */}
        <section aria-label="Account Progression" className="mt-16 pt-12 border-t border-[var(--kt-concrete)]/40">
          <div className="mb-8">
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--kt-road-grey)] block mb-2">
              Progression Pathway
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[var(--kt-asphalt)]">
              How merchant & volume accounts are activated
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">01</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">Account Registration</h3>
              <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
                Establish an authenticated customer or store profile with confirmed business and pickup credentials.
              </p>
            </div>

            <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">02</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">Volume & Route Confirmation</h3>
              <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
                Operations reviews weekly dispatch volume, parcel types, and scheduled recurring pickup windows.
              </p>
            </div>

            <div className="pt-4 border-t border-[var(--kt-concrete)] space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs font-bold text-[var(--kt-road-grey)]">03</span>
                <div className="h-px flex-1 bg-[var(--kt-concrete)]/60" />
              </div>
              <h3 className="font-display text-lg font-bold text-[var(--kt-asphalt)]">Direct Fleet Coordination</h3>
              <p className="text-xs text-[var(--kt-road-grey)] leading-relaxed">
                Dedicated driver assigned to your dispatch rhythm with direct portal manifest and tracking.
              </p>
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}
