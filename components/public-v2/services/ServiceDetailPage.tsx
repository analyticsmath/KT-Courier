import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { RouteLine } from "@/components/public-v2/graphics";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { getPublicServicePage, getServicesByFamily, serviceFaqs, type PublicServiceId } from "@/lib/public-services/service-page-registry";
import { ServiceCoverage } from "./ServiceCoverage";
import { ServiceNarrative } from "./ServiceNarrative";
import styles from "./service-pages.module.css";

export async function ServiceDetailPage({ serviceId }: { serviceId: PublicServiceId }) {
  const service = getPublicServicePage(serviceId);
  const heroMedia = getServiceMedia(service.heroMediaId);
  const relatedServices = service.relatedServiceIds.map((id) => getPublicServicePage(id));
  const siblingServices = getServicesByFamily(service.family).filter((candidate) => candidate.id !== service.id);

  return (
    <article className={styles.servicePage} data-kt-service-family={service.family} data-kt-service-page={service.slug}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
            { label: service.eyebrow, href: service.route },
          ]),
        }}
        type="application/ld+json"
      />
      <div className={styles.pageInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs items={[{ label: "Home", href: "/" }, { label: "Services", href: "/services" }, { label: service.eyebrow }]} />
        </div>
      </div>

      <section aria-labelledby={`${service.slug}-heading`} className={styles.serviceHero}>
        <div className={styles.pageInner}>
          <div className={styles.serviceHeroGrid}>
            <div className={styles.serviceHeroCopy}>
              <p className={styles.heroEyebrow}>{service.eyebrow}</p>
              <h1 className={styles.serviceHeroTitle} id={`${service.slug}-heading`}>{service.title}</h1>
              <p className={styles.serviceHeroLead}>{service.summary}</p>
              <p className={styles.heroMeta}>Current suitability is confirmed from the request details.</p>
              <div className={styles.actionGroup}>
                <Link className={styles.primaryAction} href={service.primaryAction.href}>{service.primaryAction.label} <span aria-hidden="true">→</span></Link>
                {service.secondaryAction ? <Link className={styles.secondaryAction} href={service.secondaryAction.href}>{service.secondaryAction.label}</Link> : null}
              </div>
            </div>
            <figure className={styles.serviceHeroMedia}>
              <Image alt={heroMedia.alt} fill priority sizes="(max-width: 767px) calc(100vw - 32px), (max-width: 1119px) 52vw, 48vw" src={heroMedia.src} style={{ objectPosition: heroMedia.focalPoint }} />
              <RouteLine className={styles.heroRoute} segment="hero" variant="hero" />
            </figure>
          </div>
        </div>
      </section>

      <section aria-labelledby={`${service.slug}-fit-heading`} className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>A practical fit for</p>
          <h2 className={styles.sectionHeading} id={`${service.slug}-fit-heading`}>The requests that need a clear plan.</h2>
          <ul className={styles.idealGrid}>
            {service.idealFor.map((item, index) => (
              <li className={styles.idealCard} key={item}>
                <span className={styles.processNumber}>{String(index + 1).padStart(2, "0")}</span>
                <h3>{item}</h3>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className={styles.pageInner}>
        <ServiceNarrative service={service} />
      </div>

      <section className={styles.section}>
        <div className={styles.pageInner}>
          <div className={styles.twoColumn}>
            <section aria-labelledby={`${service.slug}-prepare-heading`}>
              <p className={styles.sectionEyebrow}>Before you request</p>
              <h2 className={styles.sectionHeading} id={`${service.slug}-prepare-heading`}>Prepare the useful details.</h2>
              <ul className={styles.factorList}>{service.preparation.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
            <section aria-labelledby={`${service.slug}-quote-heading`}>
              <p className={styles.sectionEyebrow}>What shapes a quote</p>
              <h2 className={styles.sectionHeading} id={`${service.slug}-quote-heading`}>A current request, not a public price table.</h2>
              <ul className={styles.factorList}>{service.pricingFactors.map((item) => <li key={item}>{item}</li>)}</ul>
              <Link className={styles.textAction} href="/services/pricing">Read the pricing explanation <span aria-hidden="true">→</span></Link>
            </section>
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <ServiceCoverage service={service} />
      </div>

      <section className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Confirm before booking</p>
          <h2 className={styles.sectionHeading}>Details that need a team review.</h2>
          <div className={styles.confirmationGrid}>
            {service.restrictions.map((item, index) => (
              <article className={styles.confirmationCard} key={item}>
                <p className={styles.factLabel}>Review point {String(index + 1).padStart(2, "0")}</p>
                <h3>Confirm the practical details.</h3>
                <p className={styles.confirmationText}>{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby={`${service.slug}-related-heading`} className={styles.section}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Continue the atlas</p>
          <h2 className={styles.sectionHeading} id={`${service.slug}-related-heading`}>Related services.</h2>
          <div className={styles.relatedGrid}>
            {relatedServices.map((related) => {
              const media = getServiceMedia(related.heroMediaId);
              return (
                <Link className={styles.relatedCard} href={related.route} key={related.id}>
                  <div className={styles.relatedImage}>
                    <Image alt="" fill sizes="(max-width: 639px) calc(100vw - 34px), 31vw" src={media.src} style={{ objectPosition: media.focalPoint }} />
                  </div>
                  <div className={styles.relatedCopy}>
                    <p className={styles.sectionEyebrow}>{related.eyebrow}</p>
                    <h3>{related.title}</h3>
                    <p>{related.summary}</p>
                    <span className={styles.relatedArrow} aria-hidden="true">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
          {siblingServices.length > 0 ? <p className={styles.sectionIntro}>Also in this family: {siblingServices.map((sibling) => sibling.eyebrow).join(" · ")}</p> : null}
        </div>
      </section>

      <section aria-labelledby={`${service.slug}-faq-heading`} className={styles.section}>
        <div className={styles.pageInner}>
          <div className={styles.faqLayout}>
            <div>
              <p className={styles.sectionEyebrow}>Useful answers</p>
              <h2 className={styles.sectionHeading} id={`${service.slug}-faq-heading`}>Questions about this route.</h2>
            </div>
            <div className={styles.faqList}>
              {service.faqIds.map((id) => {
                const faq = serviceFaqs[id];
                return <details className={styles.faqDetails} key={id}><summary>{faq.question}</summary><p className={styles.faqAnswer}>{faq.answer}</p></details>;
              })}
              <Link className={styles.textAction} href="/faq">Read all service questions <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.ctaSection}>
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>{service.primaryActionIsQuote ? "Ready to plan?" : "Need current information?"}</p>
          <h2 className={styles.ctaTitle}>{service.primaryActionIsQuote ? "Start with the details that matter." : "Ask the team about the current pathway."}</h2>
          <p className={styles.ctaLead}>{service.primaryActionIsQuote ? "The account-based delivery form is the canonical place to provide the request details." : "Contact support for the current participation information."}</p>
          <div className={styles.actionGroup}>
            <Link className={styles.primaryAction} href={service.primaryAction.href}>{service.primaryAction.label} <span aria-hidden="true">→</span></Link>
            {service.secondaryAction ? <Link className={styles.secondaryAction} href={service.secondaryAction.href}>{service.secondaryAction.label}</Link> : null}
          </div>
        </div>
      </section>
    </article>
  );
}
