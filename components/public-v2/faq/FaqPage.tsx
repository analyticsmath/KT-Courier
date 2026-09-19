import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { publicFaqJsonLd, publicFaqSections } from "@/lib/public-faq/faqs";
import { FaqInteractiveView } from "./FaqInteractiveView";
import styles from "./faq-page.module.css";

export function FaqPage() {
  return (
    <article className={styles.faqRoot}>
      <script
        dangerouslySetInnerHTML={{
          __html: publicBreadcrumbJsonLd([
            { label: "Home", href: "/" },
            { label: "Frequently Asked Questions", href: "/faq" },
          ]),
        }}
        type="application/ld+json"
      />
      <script
        dangerouslySetInnerHTML={{ __html: publicFaqJsonLd() }}
        type="application/ld+json"
      />

      <div className={styles.faqInner}>
        <div className="mb-6">
          <Link
            href="/"
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-road-grey)] hover:text-[var(--kt-asphalt)] transition-colors inline-flex items-center gap-1.5"
          >
            ← Home
          </Link>
        </div>

        <section aria-labelledby="faq-title" className={styles.faqHero}>
          <h1 className={styles.faqTitle} id="faq-title">
            Frequently Asked Questions.
          </h1>
          <p className={styles.faqLead}>
            Practical answers about delivery requests, current quotes, coverage areas, account order updates, and merchant logistics.
          </p>
        </section>

        {/* Server-side native semantic disclosure structure */}
        <div className={styles.faqSectionWrap}>
          {publicFaqSections.map((section) => (
            <section className={styles.faqSection} id={section.id} key={section.id}>
              <h2 className={styles.faqSectionHeading}>{section.title}</h2>
              <div className={styles.faqItemList}>
                {section.items.map((item) => (
                  <details className={styles.faqItemDetails} key={item.question}>
                    <summary>{item.question}</summary>
                    <div className={styles.faqAnswer}>
                      <p>{item.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <FaqInteractiveView />
      </div>
    </article>
  );
}
