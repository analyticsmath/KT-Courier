import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import {
  getPublicServicePage,
  type PublicServiceId,
} from "@/lib/public-services/service-page-registry";
import { getServiceMedia } from "@/lib/public-assets/service-media";
import { KtIconArrowRight } from "@/components/public-v2/graphics/KtIcons";
import styles from "./service-pages.module.css";

export async function ServiceDetailPage({ serviceId }: { serviceId: PublicServiceId }) {
  const service = getPublicServicePage(serviceId);
  const heroMedia = getServiceMedia(service.heroMediaId);
  const detailMediaItems = service.detailMediaIds.map((id) => getServiceMedia(id));
  const relatedServices = service.relatedServiceIds.map((id) => getPublicServicePage(id));

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

        {/* Route Hero Grid */}
        <section aria-labelledby="service-title" className={styles.detailHeroGrid}>
          <div className={styles.detailHeroCopy}>
            <h1 className={styles.detailHeroTitle} id="service-title">
              {service.title}
            </h1>
            <p className={styles.detailHeroSummary}>{service.summary}</p>
            <div className={styles.detailHeroActions}>
              <Link className={styles.detailPrimaryAction} href={service.primaryAction.href}>
                {service.primaryAction.label} <KtIconArrowRight size={16} />
              </Link>
              {service.secondaryAction ? (
                <Link className={styles.detailSecondaryAction} href={service.secondaryAction.href}>
                  {service.secondaryAction.label}
                </Link>
              ) : null}
            </div>
          </div>

          <div className={styles.detailHeroMediaFrame}>
            <Image
              alt={heroMedia.alt}
              fill
              priority
              sizes="(max-width: 1023px) 100vw, 50vw"
              src={heroMedia.src}
              style={{
                objectFit: "cover",
                objectPosition: heroMedia.focalPoint,
              }}
            />
          </div>
        </section>

        {/* Practical Fit Section */}
        <section aria-labelledby="fit-heading" className={styles.worldSection}>
          <h2 className={styles.worldHeading} id="fit-heading">
            Practical considerations for this route.
          </h2>
          <div className={styles.worldLayoutTwoCol}>
            <ul className={styles.worldFactList}>
              {service.idealFor.map((item) => (
                <li className={styles.worldFactItem} key={item}>
                  <span className={styles.worldFactTitle}>{item}</span>
                  <p className={styles.worldFactDesc}>
                    Tailored around specific handling and coordinate requirements for this movement type.
                  </p>
                </li>
              ))}
            </ul>

            <div className={styles.worldDetailMediaGrid}>
              {detailMediaItems.slice(0, 2).map((media, idx) => (
                <div className={styles.worldDetailMediaCard} key={media.src + idx}>
                  <Image
                    alt={media.alt}
                    fill
                    sizes="(max-width: 599px) 100vw, 25vw"
                    src={media.src}
                    style={{
                      objectFit: "cover",
                      objectPosition: media.focalPoint,
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Preparation & Confirmation Requirements */}
        <section aria-labelledby="prep-factors-heading" className={styles.worldSection}>
          <h2 className={styles.worldHeading} id="prep-factors-heading">
            Before requesting delivery.
          </h2>
          <div className={styles.worldLayoutTwoCol}>
            <details className={styles.worldFactItem} open>
              <summary style={{ fontSize: "1.1rem", fontWeight: 600, cursor: "pointer", listStyle: "none" }}>
                Essential Details
              </summary>
              <ul className={styles.worldFactList} style={{ marginTop: 12 }}>
                {service.preparation.map((item) => (
                  <li key={item}>
                    <span className={styles.worldFactTitle}>{item}</span>
                  </li>
                ))}
              </ul>
            </details>

            <details className={styles.worldFactItem} open>
              <summary style={{ fontSize: "1.1rem", fontWeight: 600, cursor: "pointer", listStyle: "none" }}>
                Pricing & Review Factors
              </summary>
              <ul className={styles.worldFactList} style={{ marginTop: 12 }}>
                {service.pricingFactors.map((item) => (
                  <li key={item}>
                    <span className={styles.worldFactTitle}>{item}</span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </section>

        {/* Related Service Routes */}
        {relatedServices.length > 0 && (
          <section aria-labelledby="related-heading" className={styles.worldSection}>
            <h2 className={styles.worldHeading} id="related-heading">
              Related routes in the network.
            </h2>
            <div className={styles.relatedServicesRow}>
              {relatedServices.map((rel) => (
                <Link className={styles.relatedServiceCard} href={rel.route} key={rel.id}>
                  <span className={styles.relatedServiceTitle}>{rel.eyebrow}</span>
                  <p className={styles.relatedServiceSummary}>{rel.summary}</p>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--kt-carbon, #101210)", marginTop: 8 }}>
                    View service &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </article>
  );
}
