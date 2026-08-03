import Link from "next/link";
import { ContactForm } from "@/components/forms/ContactForm";
import { PublicBreadcrumbScript, SupportingPageHero } from "@/components/public-v2/support";
import { getSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import styles from "@/components/public-v2/support/support-pages.module.css";

const enquiryPaths = [
  { title: "Delivery question", description: "Choose this when you need help preparing or understanding a delivery request." },
  { title: "Business account", description: "Choose this for an account-based repeat-delivery enquiry." },
  { title: "Existing order", description: "Choose this when you need help with a delivery that has already been requested." },
  { title: "Pricing", description: "Choose this to ask about pricing for a particular delivery arrangement." },
  { title: "General support", description: "Choose this when none of the other published enquiry types fit your question." },
] as const;

export function ContactPage() {
  const media = getSupportingPageMedia("contact-preparation");

  return (
    <article className={styles.page}>
      <PublicBreadcrumbScript items={[{ label: "Home", href: "/" }, { label: "Contact", href: "/contact" }]} />
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "ContactPage", name: "Contact KT Couriers", url: "https://ktcouriers.com/contact" }).replace(/</g, "\\u003c") }} type="application/ld+json" />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Contact" }]}
        eyebrow="Contact"
        title="Start with the right conversation."
        summary="Use the form for a delivery question, business enquiry, existing-order help, pricing question, or general support request."
        primaryAction={{ label: "Send an enquiry", href: "#contact-form" }}
        secondaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        media={media}
        variant="contact"
      />

      <section className={styles.section} aria-labelledby="contact-pathways-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Enquiry orientation</p>
          <div className={styles.contactLayout}>
            <div>
              <h2 className={styles.sectionHeading} id="contact-pathways-heading">Choose the form option that matches the question.</h2>
              <p className={styles.sectionIntro}>KT Couriers publishes these enquiry types in the existing form. They guide the message without creating separate support systems or contact endpoints.</p>
              <ul className={styles.contactPathways}>
                {enquiryPaths.map((path) => <li key={path.title}><h3>{path.title}</h3><p>{path.description}</p></li>)}
              </ul>
            </div>
            <div className={styles.contactFormPanel} id="contact-form">
              <h2 className={styles.contactFormHeading}>Send an enquiry</h2>
              <p className={styles.contactLead}>The same contact form validates your message and submits it through the existing KT Couriers support flow.</p>
              <ContactForm />
              <p className={styles.privacyNote}>Please provide only the information needed for your enquiry. Read the <Link className={styles.textAction} href="/privacy-policy">privacy policy</Link> for the current public privacy information.</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="alternative-paths-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Other useful routes</p>
          <div className={styles.split}>
            <h2 className={styles.sectionHeading} id="alternative-paths-heading">Use the account path when the work is already in progress.</h2>
            <div>
              <p className={styles.bodyCopy}>The delivery request route is the canonical way to provide the details needed for a current quote. Customers and stores can return to their account to view order-status updates.</p>
              <p className={styles.bodyCopy}>KT Couriers does not publish an office address, phone number, email address, social profile, or map on this page because those details are not verified as public contact information.</p>
              <div className={styles.actionGroup}>
                <Link className={styles.secondaryAction} href="/account/orders">View account order updates <span aria-hidden="true">→</span></Link>
                <Link className={styles.textAction} href="/faq#support">Read support answers <span aria-hidden="true">→</span></Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </article>
  );
}
