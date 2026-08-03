import Image from "next/image";
import Link from "next/link";
import { EditorialFactList, PublicBreadcrumbScript, SupportingClosingCta, SupportingPageHero } from "@/components/public-v2/support";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import styles from "@/components/public-v2/support/support-pages.module.css";

const ecosystem = [
  {
    title: "Customers",
    description: "Customers use an account-based request flow to provide pickup, dropoff, parcel, and delivery details.",
  },
  {
    title: "Stores and businesses",
    description: "Business and store accounts support repeat delivery requests, active order visibility, and delivery history.",
  },
  {
    title: "Delivery operations",
    description: "Requests are reviewed with the practical information supplied before current availability and the next step are confirmed.",
  },
  {
    title: "Driver network",
    description: "Driver-network participation information is confirmed directly by the team; it is not presented as an open public enrolment flow.",
  },
] as const;

const principles = [
  {
    title: "Clear handoffs",
    description: "The request flow captures both locations, recipient information, and practical notes in one place.",
  },
  {
    title: "Account-based progress",
    description: "Customers and stores return to their account area to view order-status updates rather than relying on a live driver location.",
  },
  {
    title: "Availability confirmed from the request",
    description: "Coverage and service suitability are confirmed from the specific delivery information supplied.",
  },
  {
    title: "Practical business coordination",
    description: "Store and business pathways are designed around repeat delivery requests and order visibility.",
  },
] as const;

export function AboutPage() {
  const operationsMedia = getSupportingPageMedia("about-operations");
  const detailMedia = getSupportingPageMedia("about-detail");

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "About", href: "/about" }]} />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "About" }]}
        eyebrow="About KT Couriers"
        title="Delivery is the visible part. Coordination is the system behind it."
        summary="KT Couriers provides an account-based way for customers, stores, and businesses to request, manage, and coordinate local deliveries."
        primaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        media={operationsMedia}
        variant="institutional"
      />

      <section className={styles.section} aria-labelledby="about-thesis-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>The operating thesis</p>
          <div className={styles.split}>
            <div>
              <h2 className={styles.sectionHeading} id="about-thesis-heading">One request creates a clearer handoff.</h2>
            </div>
            <div>
              <p className={styles.bodyCopy}>A delivery starts with practical information: where collection happens, where the handoff ends, what is moving, and who needs to receive it. KT Couriers keeps that information in an account-based request path instead of scattering it across calls and messages.</p>
              <p className={styles.bodyCopy}>After a request is reviewed, customers and businesses can return to their account to view order-status updates and delivery history.</p>
              <Link className={styles.textAction} href="/account/orders">View account order updates <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="ecosystem-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>What KT Couriers connects</p>
          <div className={styles.mediaSplit}>
            <div>
              <h2 className={styles.sectionHeading} id="ecosystem-heading">The people, details, and account spaces around a delivery.</h2>
              <ol className={styles.ecosystemList}>
                {ecosystem.map((item, index) => (
                  <li key={item.title}>
                    <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                    <div><h3>{item.title}</h3><p>{item.description}</p></div>
                  </li>
                ))}
              </ol>
            </div>
            <figure className={styles.mediaFrame}>
              <Image alt={detailMedia.alt} fill sizes="(max-width: 767px) calc(100vw - 40px), 38vw" src={detailMedia.src} style={{ objectPosition: detailMedia.focalPoint }} />
              <figcaption className={styles.mediaCaption}>Provisional parcel-detail media · replacement pending</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="principles-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Operating principles</p>
          <div className={styles.split}>
            <h2 className={styles.sectionHeading} id="principles-heading">Designed around the information a handoff needs.</h2>
            <ol className={styles.principleList}>
              {principles.map((item, index) => (
                <li key={item.title}>
                  <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <div><h3>{item.title}</h3><p>{item.description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="pathways-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Public pathways</p>
          <div className={styles.split}>
            <div><h2 className={styles.sectionHeading} id="pathways-heading">Start with the path that matches the work.</h2></div>
            <EditorialFactList facts={[
              { label: "Delivery", value: "Request a quote", detail: "Use the authenticated request path for current pricing and availability." },
              { label: "Business", value: "Explore repeat delivery", detail: "Business courier information explains the account-based path for stores and local businesses." },
              { label: "Participation", value: "Ask the team", detail: "Driver-network participation information is confirmed by KT Couriers." },
            ]} />
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <SupportingClosingCta
          eyebrow="Next step"
          title="Plan the delivery from the details that matter."
          summary="Use the delivery request flow for a current quote, or contact the team when you need help choosing the right path."
          primaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
          secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        />
      </div>
    </article>
  );
}
