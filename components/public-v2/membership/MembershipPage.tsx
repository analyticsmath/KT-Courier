import Image from "next/image";
import Link from "next/link";
import { EditorialFactList, PublicBreadcrumbScript, SupportingClosingCta, SupportingPageHero } from "@/components/public-v2/support";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import styles from "@/components/public-v2/support/support-pages.module.css";

export function MembershipPage() {
  const media = getSupportingPageMedia("membership-planning");

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Membership", href: "/membership" }]} />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Membership" }]}
        eyebrow="Membership"
        title="Membership information, without a checkout promise."
        summary="KT Couriers has account and subscription foundations, but online membership activation and checkout are not currently available to the public."
        primaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        secondaryAction={{ label: "Explore services", href: "/services" }}
        media={media}
        variant="membership"
      />

      <section className={styles.section} aria-labelledby="membership-state-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Current public state</p>
          <div className={styles.mediaSplit}>
            <div>
              <h2 className={styles.sectionHeading} id="membership-state-heading">Information only. No public activation is presented.</h2>
              <p className={styles.sectionIntro}>The public page does not show a plan, a price, a benefit catalogue, a billing schedule, or a subscription control because those details are not verified as a current public offering.</p>
              <p className={styles.inlineNote}>A delivery request remains separate from membership. Use the normal account-based request route for current delivery availability and quotes.</p>
            </div>
            <figure className={styles.mediaFrame}>
              <Image alt={media.alt} fill sizes="(max-width: 767px) calc(100vw - 40px), 38vw" src={media.src} style={{ objectPosition: media.focalPoint }} />
              <figcaption className={styles.mediaCaption}>Provisional planning context · not a plan benefit</figcaption>
            </figure>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="membership-authority-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>What is verified</p>
          <div className={styles.split}>
            <h2 className={styles.sectionHeading} id="membership-authority-heading">The public route follows the current authority, not a sales template.</h2>
            <EditorialFactList facts={[
              { label: "Availability", value: "Informational only", detail: "No public plan activation or purchase route is offered." },
              { label: "Price and billing", value: "Not published", detail: "This page does not present a price, renewal cycle, or payment control." },
              { label: "Benefits", value: "Not published", detail: "No delivery discount, priority, coverage, or other benefit is claimed here." },
              { label: "Next step", value: "Confirm with KT Couriers", detail: "Use the contact form when you need current membership or business-arrangement information." },
            ]} />
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="membership-questions-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Useful distinction</p>
          <div className={styles.split}>
            <h2 className={styles.sectionHeading} id="membership-questions-heading">Need to send something now?</h2>
            <div>
              <p className={styles.bodyCopy}>Requesting a delivery does not require a public membership checkout. The delivery request flow is the canonical way to provide the information used for a current quote.</p>
              <p className={styles.bodyCopy}>If the question is about repeat operations, the business courier route explains the account-based pathway for stores and local businesses.</p>
              <Link className={styles.textAction} href="/services/business">Read about business courier <span aria-hidden="true">→</span></Link>
            </div>
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <SupportingClosingCta
          eyebrow="Current route"
          title="Ask for current information, or start a delivery request."
          summary="KT Couriers can confirm the appropriate next step without presenting a subscription action that is not currently available."
          primaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
          secondaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        />
      </div>
    </article>
  );
}
