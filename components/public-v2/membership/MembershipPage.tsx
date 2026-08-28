import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
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
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Membership" }]}
          />
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
                <Link className={styles.primaryAction} href="/account/request-delivery">
                  <span>Request a Delivery Quote</span>
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
      </div>
    </article>
  );
}
