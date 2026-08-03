import Link from "next/link";
import { SupportingClosingCta, SupportingPageHero } from "@/components/public-v2/support";
import { publicFaqJsonLd, publicFaqSections } from "@/lib/public-faq/faqs";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import styles from "@/components/public-v2/support/support-pages.module.css";

export function FaqPage() {
  return (
    <article className={styles.page}>
      <script dangerouslySetInnerHTML={{ __html: publicBreadcrumbJsonLd([{ label: "Home", href: "/" }, { label: "FAQ", href: "/faq" }]) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: publicFaqJsonLd() }} type="application/ld+json" />
      <SupportingPageHero
        breadcrumb={[{ label: "Home", href: "/" }, { label: "FAQ" }]}
        eyebrow="Help and FAQ"
        title="Answers before the request."
        summary="Practical answers about delivery requests, current quotes, coverage, account updates, business pathways, membership, and support."
        primaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        secondaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
        variant="reading"
      />

      <section className={styles.section} aria-labelledby="faq-index-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Browse by question</p>
          <h2 className={styles.sectionHeading} id="faq-index-heading">Choose the answer you need.</h2>
          <ol className={styles.categoryIndex}>
            {publicFaqSections.map((section) => <li key={section.id}><Link href={`#${section.id}`}>{section.title}</Link></li>)}
          </ol>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="faq-answers-heading">
        <div className={styles.pageInner}>
          <p className={styles.sectionEyebrow}>Answers</p>
          <h2 className={styles.sectionHeading} id="faq-answers-heading">The details that help you act.</h2>
          <div className={styles.faqLayout}>
            <p className={styles.bodyCopy}>Each answer stays open when you need it. The question list is fully available without JavaScript and has no search because the current FAQ set is concise.</p>
            <div>
              {publicFaqSections.map((section) => (
                <section className={styles.faqSection} id={section.id} key={section.id} aria-labelledby={`${section.id}-heading`}>
                  <h2 id={`${section.id}-heading`}>{section.title}</h2>
                  <div className={styles.faqList}>
                    {section.items.map((item) => <details key={item.question}><summary>{item.question}</summary><p className={styles.faqAnswer}>{item.answer}</p></details>)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className={styles.pageInner}>
        <SupportingClosingCta
          eyebrow="Still need help?"
          title="Start with the closest conversation."
          summary="Use the contact form for delivery questions, business enquiries, existing-order help, pricing, or general support."
          primaryAction={{ label: "Contact KT Couriers", href: "/contact" }}
          secondaryAction={{ label: "Get a quote", href: "/account/request-delivery" }}
        />
      </div>
    </article>
  );
}
