import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import {
  getPublicServicePage,
  serviceFaqs,
  type PublicServiceId,
  type PublicServicePageDefinition,
} from "@/lib/public-services/service-page-registry";
import {
  ParcelServiceView,
  EcommerceServiceView,
  FoodServiceView,
  GroceryServiceView,
  PharmacyServiceView,
  MovingServiceView,
  FreightServiceView,
  ShuttleServiceView,
  BusinessServiceView,
  DriverNetworkServiceView,
  PricingServiceView,
} from "@/components/public-v3/services/authored";
import styles from "./service-pages.module.css";

// Canonical public quote path for delivery requests
export const CANONICAL_QUOTE_PATH = "/account/request-delivery";

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
   ROOT SERVICE DETAIL PAGE (AUTHORED ROUTE DELEGATOR)
   ========================================================================= */
export async function ServiceDetailPage({ serviceId }: { serviceId: PublicServiceId }) {
  const service = getPublicServicePage(serviceId);

  const renderAuthoredView = () => {
    switch (service.id) {
      case "parcel":
        return <ParcelServiceView service={service} />;
      case "ecommerce":
        return <EcommerceServiceView service={service} />;
      case "food":
        return <FoodServiceView service={service} />;
      case "grocery":
        return <GroceryServiceView service={service} />;
      case "pharmacy":
        return <PharmacyServiceView service={service} />;
      case "moving":
        return <MovingServiceView service={service} />;
      case "freight":
        return <FreightServiceView service={service} />;
      case "shuttle":
        return <ShuttleServiceView service={service} />;
      case "business":
        return <BusinessServiceView service={service} />;
      case "driver-network":
        return <DriverNetworkServiceView service={service} />;
      case "pricing":
        return <PricingServiceView service={service} />;
      default:
        return <ParcelServiceView service={service} />;
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

        {/* Authored Route View */}
        {renderAuthoredView()}

        {/* Route FAQs with Native <details> */}
        <ServiceFaqSection service={service} />
      </div>
    </article>
  );
}
