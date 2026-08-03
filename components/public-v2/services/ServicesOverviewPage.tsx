import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { RouteLine } from "@/components/public-v2/graphics";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { getServicesByFamily, publicServiceFamilies, publicServicePages, serviceFaqs } from "@/lib/public-services/service-page-registry";
import styles from "./service-pages.module.css";

const overviewFaqIds = ["request", "coverage", "business", "pricing"] as const;

export function ServicesOverviewPage() {
  const primaryMedia = getServiceMedia("business-dispatch");
  const detailMedia = getServiceMedia("parcel-detail");

  return (
    <article className={styles.servicesOverview}>
      <script
        dangerouslySetInnerHTML={{ __html: publicBreadcrumbJsonLd([{ label: "Home", href: "/" }, { label: "Services", href: "/services" }]) }}
        type="application/ld+json"
      />
      <div className={styles.pageInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services" }]} />
        </div>
      </div>

      <section aria-labelledby="services-overview-heading" className={styles.overviewHero}>
        <div className={styles.pageInner}>
          <div className={styles.overviewHeroGrid}>
            <div className={styles.overviewHeroCopy}>
              <p className={styles.heroEyebrow}>The movement atlas · 11 service routes</p>
              <h1 className={styles.overviewHeroTitle} id="services-overview-heading">Every delivery has a different shape.</h1>
              <p className={styles.overviewHeroLead}>Explore courier, fulfilment, planned-movement, and quote-explanation routes built around what you are sending and how it needs to move.</p>
              <div className={styles.actionGroup}>
                <Link className={styles.primaryAction} href="/account/request-delivery">Get a quote <span aria-hidden="true">→</span></Link>
                <Link className={styles.secondaryAction} href="#service-index">Browse all services</Link>
              </div>
            </div>
            <div className={styles.overviewMediaStack}>
              <figure className={styles.overviewPrimaryMedia}>
                <Image alt={primaryMedia.alt} fill priority sizes="(max-width: 767px) calc(100vw - 32px), 48vw" src={primaryMedia.src} style={{ objectPosition: primaryMedia.focalPoint }} />
                <RouteLine className={styles.heroRoute} segment="hero" variant="hero" />
              </figure>
              <figure className={styles.overviewSecondaryMedia}>
                <Image alt={detailMedia.alt} fill sizes="(max-width: 767px) 64vw, 28vw" src={detailMedia.src} style={{ objectPosition: detailMedia.focalPoint }} />
              </figure>
              <p className={styles.overviewMediaCaption}>Approved provisional R2/R4 campaign media; service suitability is confirmed from the request.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="service-index-heading" className={styles.section} id="service-index">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Complete service index</p>
          <h2 className={styles.sectionHeading} id="service-index-heading">Choose a route, then plan the request.</h2>
          <ol className={styles.overviewIndex}>
            {publicServicePages.map((service, index) => (
              <li key={service.id}>
                <Link className={styles.indexRow} href={service.route}>
                  <span className={styles.indexNumber}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{service.eyebrow}</h3>
                  <p>{service.summary}</p>
                  <span className={styles.indexArrow} aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="families-heading" className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Four ways to orient the work</p>
          <h2 className={styles.sectionHeading} id="families-heading">Choose by what you are moving.</h2>
          <div className={styles.familyList}>
            {publicServiceFamilies.map((family) => {
              const services = getServicesByFamily(family.id);
              return (
                <section className={styles.familyCard} key={family.id}>
                  <p className={styles.familyLabel}>{family.label}</p>
                  <h3>{family.description}</h3>
                  <ul>{services.map((service) => <li key={service.id}><Link href={service.route}>{service.eyebrow} <span aria-hidden="true">→</span></Link></li>)}</ul>
                </section>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Shared process</p>
          <h2 className={styles.sectionHeading}>One request, made specific to the delivery.</h2>
          <ol className={styles.processGrid}>
            <li className={styles.processCard}><span className={styles.processNumber}>01</span><h3>Choose the delivery type</h3><p>Start with the delivery type that best describes the request.</p></li>
            <li className={styles.processCard}><span className={styles.processNumber}>02</span><h3>Provide practical details</h3><p>Add addresses, recipient information, parcel details, and relevant notes.</p></li>
            <li className={styles.processCard}><span className={styles.processNumber}>03</span><h3>Receive a reviewed next step</h3><p>The request is reviewed and current availability is confirmed through the account flow.</p></li>
            <li className={styles.processCard}><span className={styles.processNumber}>04</span><h3>View account updates</h3><p>Customers and stores can return to their account area to view order-status updates.</p></li>
          </ol>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Useful pathways</p>
          <h2 className={styles.sectionHeading}>Pricing, coverage, and repeat operations.</h2>
          <div className={styles.overviewPathways}>
            <article className={styles.pathwayCard}><p className={styles.familyLabel}>Pricing</p><h3>Understand the request before asking for a quote.</h3><p>There is no public rate table or calculator. Current pricing comes through the authenticated request flow.</p><Link className={styles.textAction} href="/services/pricing">Read the pricing explanation <span aria-hidden="true">→</span></Link></article>
            <article className={styles.pathwayCard}><p className={styles.familyLabel}>Coverage</p><h3>Local service areas, checked against the request.</h3><p>Use the coverage page for configured local areas, then confirm pickup and dropoff suitability with the request.</p><Link className={styles.textAction} href="/coverage-areas">View coverage areas <span aria-hidden="true">→</span></Link></article>
            <article className={styles.pathwayCard}><p className={styles.familyLabel}>Business and network</p><h3>For repeat operations and the people behind handoffs.</h3><p>Business customers use account-based requests. Driver-network information is confirmed by the team.</p><Link className={styles.textAction} href="/services/business">Explore business courier <span aria-hidden="true">→</span></Link></article>
          </div>
        </div>
      </section>

      <section aria-labelledby="services-faq-heading" className={styles.section}>
        <div className={styles.pageInner}>
          <div className={styles.faqLayout}>
            <div><p className={styles.sectionEyebrow}>Useful answers</p><h2 className={styles.sectionHeading} id="services-faq-heading">Before you begin.</h2></div>
            <div className={styles.faqList}>
              {overviewFaqIds.map((id) => <details className={styles.faqDetails} key={id}><summary>{serviceFaqs[id].question}</summary><p className={styles.faqAnswer}>{serviceFaqs[id].answer}</p></details>)}
              <Link className={styles.textAction} href="/faq">Read all service questions <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Ready to plan?</p>
          <h2 className={styles.ctaTitle}>Start with the delivery details.</h2>
          <p className={styles.ctaLead}>The request form is the canonical route to a current quote and account-based order visibility.</p>
          <div className={styles.actionGroup}><Link className={styles.primaryAction} href="/account/request-delivery">Get a quote <span aria-hidden="true">→</span></Link></div>
        </div>
      </section>
    </article>
  );
}
