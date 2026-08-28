import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import {
  getPublicServicePage,
  serviceFaqs,
  type PublicServiceId,
  type PublicServicePageDefinition,
} from "@/lib/public-services/service-page-registry";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./service-pages.module.css";

interface ServiceWorldProps {
  service: PublicServicePageDefinition;
}

function ServiceFaqSection({ service }: ServiceWorldProps) {
  if (!service.faqIds.length) return null;
  return (
    <section aria-labelledby="service-faq-heading" className={styles.serviceFaqSection}>
      <h2 className={styles.worldSectionTitle} id="service-faq-heading">
        Route Information & Questions
      </h2>
      <div className={styles.faqList}>
        {service.faqIds.map((faqId) => {
          const faq = serviceFaqs[faqId];
          if (!faq) return null;
          return (
            <details className={styles.serviceFaqDetails} key={faqId}>
              <summary className={styles.serviceFaqSummary}>{faq.question}</summary>
              <p className={styles.serviceFaqAnswer}>{faq.answer}</p>
            </details>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================================
   FAMILY 1: TACTILE EVERYDAY (parcel, food, grocery, pharmacy)
   ========================================================================= */
function TactileEverydayWorld({ service }: ServiceWorldProps) {
  const heroMedia = getServiceMedia(service.heroMediaId);
  const detailMediaItems = service.detailMediaIds.map((id) => getServiceMedia(id));

  return (
    <div className={styles.tactileWorld}>
      {/* Editorial Tactile Stage */}
      <section className={styles.tactileHero}>
        <div className={styles.tactileCopyPlane}>
          <h1 className={styles.tactileTitle}>{service.title}</h1>
          <p className={styles.tactileLead}>{service.summary}</p>
          <div className={styles.detailHeroActions}>
            <Link className={styles.detailPrimaryAction} href={service.primaryAction.href}>
              {service.primaryAction.label} <KtIconArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className={styles.tactileMediaShowcase}>
          <Image
            alt={heroMedia.alt}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 60vw"
            src={heroMedia.src}
            style={{ objectFit: "cover", objectPosition: heroMedia.focalPoint }}
          />
        </div>
      </section>

      {/* Item Handling & Dispatch Guidelines */}
      <section className={styles.tactileDetailsSection}>
        <h2 className={styles.worldSectionTitle}>Handling & Dispatch Details</h2>
        <div className={styles.tactileGrid}>
          <div className={styles.tactileCard}>
            <h3 className={styles.cardHeader}>Suitable Items</h3>
            <ul className={styles.bulletList}>
              {service.idealFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.tactileCard}>
            <h3 className={styles.cardHeader}>Preparation Notes</h3>
            <ul className={styles.bulletList}>
              {service.preparation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {detailMediaItems.length > 0 && (
          <div className={styles.tactilePhotoStrip}>
            {detailMediaItems.map((m, idx) => (
              <div className={styles.photoStripCard} key={m.src + idx}>
                <Image
                  alt={m.alt}
                  fill
                  sizes="320px"
                  src={m.src}
                  style={{ objectFit: "cover", objectPosition: m.focalPoint }}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <ServiceFaqSection service={service} />
    </div>
  );
}

/* =========================================================================
   FAMILY 2: COMMERCE & BUSINESS FLOW (ecommerce, business, driver-network)
   ========================================================================= */
function CommerceBusinessWorld({ service }: ServiceWorldProps) {
  const heroMedia = getServiceMedia(service.heroMediaId);
  const detailMediaItems = service.detailMediaIds.map((id) => getServiceMedia(id));

  return (
    <div className={styles.businessWorld}>
      {/* Asymmetric Commercial Header */}
      <section className={styles.businessHero}>
        <div className={styles.businessMediaLarge}>
          <Image
            alt={heroMedia.alt}
            fill
            priority
            sizes="(max-width: 1023px) 100vw, 55vw"
            src={heroMedia.src}
            style={{ objectFit: "cover", objectPosition: heroMedia.focalPoint }}
          />
        </div>

        <div className={styles.businessTextPlane}>
          <h1 className={styles.businessTitle}>{service.title}</h1>
          <p className={styles.businessSummary}>{service.summary}</p>
          <div className={styles.detailHeroActions}>
            <Link className={styles.detailPrimaryAction} href={service.primaryAction.href}>
              {service.primaryAction.label} <KtIconArrowRight size={16} />
            </Link>
            {service.secondaryAction && (
              <Link className={styles.detailSecondaryAction} href={service.secondaryAction.href}>
                {service.secondaryAction.label}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Operational Workflow Architecture */}
      <section className={styles.businessWorkflowSection}>
        <h2 className={styles.worldSectionTitle}>Merchant Operations & Integration</h2>
        <div className={styles.businessWorkflowList}>
          {service.idealFor.map((item, idx) => (
            <div className={styles.workflowRow} key={item}>
              <span className={styles.workflowIndex}>0{idx + 1}</span>
              <div>
                <h3 className={styles.workflowHeading}>{item}</h3>
                <p className={styles.workflowDesc}>
                  Configured through authenticated account management and coordinate-based dispatch review.
                </p>
              </div>
            </div>
          ))}
        </div>

        {detailMediaItems.length > 0 && (
          <div className={styles.businessMediaFrame}>
            <Image
              alt={detailMediaItems[0].alt}
              fill
              sizes="(max-width: 1023px) 100vw, 1200px"
              src={detailMediaItems[0].src}
              style={{ objectFit: "cover" }}
            />
          </div>
        )}
      </section>

      <ServiceFaqSection service={service} />
    </div>
  );
}

/* =========================================================================
   FAMILY 3: PLANNED MOVEMENT (freight, moving, shuttle)
   ========================================================================= */
function PlannedMovementWorld({ service }: ServiceWorldProps) {
  const heroMedia = getServiceMedia(service.heroMediaId);

  return (
    <div className={styles.plannedWorld}>
      {/* Full-width Environmental Landscape */}
      <section className={styles.plannedHero}>
        <div className={styles.plannedLandscapeFrame}>
          <Image
            alt={heroMedia.alt}
            fill
            priority
            sizes="100vw"
            src={heroMedia.src}
            style={{ objectFit: "cover", objectPosition: heroMedia.focalPoint }}
          />
        </div>

        <div className={styles.plannedOverlayBox}>
          <h1 className={styles.plannedTitle}>{service.title}</h1>
          <p className={styles.plannedLead}>{service.summary}</p>
          <div className={styles.detailHeroActions}>
            <Link className={styles.detailPrimaryAction} href={service.primaryAction.href}>
              {service.primaryAction.label} <KtIconArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Spatial Variables & Route Considerations */}
      <section className={styles.plannedSpatialSection}>
        <h2 className={styles.worldSectionTitle}>Spatial & Scheduling Variables</h2>
        <div className={styles.spatialMatrix}>
          <div className={styles.spatialCard}>
            <h3 className={styles.cardHeader}>Capacity & Dimensions</h3>
            <ul className={styles.bulletList}>
              {service.idealFor.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className={styles.spatialCard}>
            <h3 className={styles.cardHeader}>Scheduling Requirements</h3>
            <ul className={styles.bulletList}>
              {service.preparation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ServiceFaqSection service={service} />
    </div>
  );
}

/* =========================================================================
   FAMILY 4: PRICING INTELLIGENCE (pricing)
   ========================================================================= */
function PricingIntelligenceWorld({ service }: ServiceWorldProps) {
  const pricingSteps = [
    {
      title: "1. Pickup Location",
      desc: "Street address and coordinate verification within active collection corridors.",
    },
    {
      title: "2. Dropoff Destination",
      desc: "Transit distance and route terrain across regional delivery corridors.",
    },
    {
      title: "3. Item Details & Volume",
      desc: "Parcel count, physical dimensions, weight tier, and specialized handling instructions.",
    },
    {
      title: "4. Timing & Dispatch",
      desc: "Standard dispatch workflow or planned scheduling preferences.",
    },
    {
      title: "5. Review & Final Quote",
      desc: "Transparent price confirmation generated directly through the delivery request flow.",
    },
  ];

  return (
    <div className={styles.pricingWorld}>
      <section className={styles.pricingHero}>
        <h1 className={styles.pricingTitle}>{service.title}</h1>
        <p className={styles.pricingLead}>{service.summary}</p>
      </section>

      {/* Dynamic Variable Pipeline */}
      <section className={styles.pricingPipelineSection}>
        <h2 className={styles.worldSectionTitle}>Calculation Variables</h2>
        <div className={styles.pricingPipelineList}>
          {pricingSteps.map((step) => (
            <div className={styles.pricingStepCard} key={step.title}>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>

        <div className={styles.pricingActionBlock}>
          <h3 style={{ fontSize: "1.4rem", fontWeight: 600, margin: "0 0 12px" }}>
            Ready to request a delivery quote?
          </h3>
          <p style={{ color: "var(--kt-cool-350, #adb5b2)", margin: "0 0 24px", maxWidth: 600 }}>
            Enter your pickup and drop-off coordinates in the delivery request form to receive an exact quote.
          </p>
          <Link className={styles.detailPrimaryAction} href={service.primaryAction.href}>
            <span>Request a Delivery Quote</span>
            <KtIconArrowRight size={16} />
          </Link>
        </div>
      </section>

      <ServiceFaqSection service={service} />
    </div>
  );
}

/* =========================================================================
   ROOT SERVICE DETAIL PAGE (FAMILY ROUTER)
   ========================================================================= */
export async function ServiceDetailPage({ serviceId }: { serviceId: PublicServiceId }) {
  const service = getPublicServicePage(serviceId);

  const renderWorld = () => {
    switch (service.family) {
      case "EVERYDAY_MOVEMENT":
        return <TactileEverydayWorld service={service} />;
      case "BUSINESS_FLOW":
        return <CommerceBusinessWorld service={service} />;
      case "PLANNED_MOVEMENT":
        return <PlannedMovementWorld service={service} />;
      case "QUOTE_INTELLIGENCE":
        return <PricingIntelligenceWorld service={service} />;
    }
  };

  return (
    <article
      className={styles.detailPage}
      data-kt-service-family={service.family}
      data-kt-service-page={service.slug}
    >
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
          <PublicBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Services", href: "/services" },
              { label: service.eyebrow },
            ]}
          />
        </div>

        {/* Authored Composition Family Renderer */}
        {renderWorld()}
      </div>
    </article>
  );
}
