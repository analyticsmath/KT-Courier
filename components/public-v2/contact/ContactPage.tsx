import Image from "next/image";
import Link from "next/link";
import { EditorialMotion } from "@/components/public-v3/redesign/EditorialMotion";
import { ContactTopics } from "@/components/public-v3/editorial/ContactTopics";
import { ContactForm } from "@/components/forms/ContactForm";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import styles from "@/components/public-v3/editorial/editorial-pages.module.css";
export function ContactPage() {
  return (
    <EditorialMotion>
      <article className={styles.page}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: publicBreadcrumbJsonLd([
              { label: "Home", href: "/" },
              { label: "Contact", href: "/contact" },
            ]),
          }}
        />
        <section className={`${styles.hero} ${styles.contactHero}`}>
          <div className={styles.heroHeader}>
            <h1 data-split-heading>
              Good conversations.
              <br />
              Better next steps.
            </h1>
            <div className={styles.heroAside}>
              <p>
                A question about a delivery? A business ready for its next move?
                Tell us what you have in mind.
              </p>
              <a href="mailto:info@ktcouriers.com" className="kt-text-link">
                info@ktcouriers.com ↗
              </a>
            </div>
          </div>
          <div className={styles.heroPhoto} data-media-aperture>
            <Image
              data-parallax
              src="/media/public/editorial/conversation.webp"
              alt="A shopkeeper talking through an order with a customer"
              fill
              preload
              sizes="100vw"
            />
          </div>
        </section>
        <ContactTopics />
        <section
          id="contact-form"
          tabIndex={-1}
          className={styles.formSection}
          data-chapter-takeover
        >
          <div className={styles.formHeading}>
            <h2 data-split-heading>
              A few details.
              <br />A clear beginning.
            </h2>
            <p>
              Your enquiry goes to the KT Couriers team. Choose the topic that
              fits and tell us how we can help.
            </p>
          </div>
          <div className={styles.formLayout}>
            <div className={styles.formBody}>
              <ContactForm />
              <p className={styles.privacy}>
                Share only the information needed to help with your request.
                Read our <Link href="/privacy-policy">Privacy Policy</Link>.
              </p>
            </div>
            <aside className={styles.formMedia}>
              <div className={styles.formPhoto} data-media-aperture>
                <Image
                  data-parallax
                  src="/media/public/home/kt-home-09-package-detail.webp"
                  alt="A carefully wrapped parcel with a personal thank-you note"
                  fill
                  sizes="(max-width:760px) 90vw, 40vw"
                />
              </div>
              <p>
                Already have an active order? Your account brings its latest
                updates and delivery history together.
              </p>
              <Link href="/track" className="kt-text-link">
                Find your delivery ↗
              </Link>
            </aside>
          </div>
        </section>
        <section className={styles.questions} data-section-transition="rise">
          <h2 data-split-heading>
            A little clarity.
            <br />
            Before we talk.
          </h2>
          <div>
            <details open>
              <summary>Can I visit an office?</summary>
              <p>
                KT Couriers operates online and has no public walk-in office.
                Use the enquiry form or email{" "}
                <a href="mailto:info@ktcouriers.com">info@ktcouriers.com</a>.
              </p>
            </details>
            <details>
              <summary>What should I include?</summary>
              <p>
                For a new delivery, include the service you’re considering and
                the locations involved. For an existing order, include the order
                reference and a clear description of your question.
              </p>
            </details>
            <details>
              <summary>Just need a delivery quote?</summary>
              <p>
                You can start with pickup, destination and parcel details in the
                quote flow. <Link href="/quote">Get a delivery quote ↗</Link>
              </p>
            </details>
          </div>
        </section>
      </article>
    </EditorialMotion>
  );
}
