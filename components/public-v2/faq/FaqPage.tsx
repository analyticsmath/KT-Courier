import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { publicFaqJsonLd } from "@/lib/public-faq/faqs";
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
            className="text-xs font-mono tracking-wider uppercase text-[var(--kt-public-text-muted)] hover:text-[var(--kt-public-text-primary)] transition-colors inline-flex items-center gap-1.5"
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

        {/* The client view is also server-rendered with native disclosures. */}
        <FaqInteractiveView />
      </div>
    </article>
  );
}
