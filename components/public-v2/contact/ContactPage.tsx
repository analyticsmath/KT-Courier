import Image from "next/image";
import Link from "next/link";
import { PublicBreadcrumbs } from "@/components/public-v2/navigation";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { ContactForm } from "@/components/forms/ContactForm";
import { homeMedia } from "@/components/public-v2/home/home-media";
import styles from "./contact-page.module.css";

export function ContactPage() {
  return (
    <article className={styles.contactRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Contact Support", href: "/contact" },
          ]),
        }}
        type="application/ld+json"
      />

      <div className={styles.contactInner}>
        <div className={styles.breadcrumbs}>
          <PublicBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Contact" }]}
          />
        </div>

        <section aria-labelledby="contact-title" className={styles.contactHero}>
          <h1 className={styles.contactTitle} id="contact-title">
            Start with the right conversation.
          </h1>
          <p className={styles.contactLead}>
            Direct your message to our logistics and account support coordinators.
          </p>
        </section>

        <div className={styles.contactFormLayout}>
          {/* Form Column */}
          <div className={styles.contactFormColumn}>
            <div className={styles.formContainer}>
              <ContactForm />
              <p className={styles.privacyNotice}>
                Please provide only the necessary dispatch or account information. Read our{" "}
                <Link className={styles.privacyLink} href="/privacy-policy">
                  Privacy Policy
                </Link>{" "}
                for data protection standards.
              </p>
            </div>
          </div>

          {/* Desktop Media Fragment */}
          <div className={styles.contactMediaColumn}>
            <div className={styles.contactMediaFrame}>
              <Image
                alt={homeMedia.merchantPrepare.alt}
                fill
                priority
                sizes="(max-width: 1023px) 0px, 480px"
                src={homeMedia.merchantPrepare.src}
                style={{ objectFit: "cover" }}
              />
            </div>
            <div className={styles.contactAccountBox}>
              <h3 className={styles.accountBoxTitle}>Already have an active order?</h3>
              <p className={styles.accountBoxText}>
                You can review verified status updates directly inside your account orders dashboard without waiting for email support.
              </p>
              <Link className={styles.accountBoxLink} href="/account/orders">
                View Account Orders &rarr;
              </Link>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
