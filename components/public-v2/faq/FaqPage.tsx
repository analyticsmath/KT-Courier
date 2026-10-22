import Link from "next/link";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { publicFaqJsonLd } from "@/lib/public-faq/faqs";
import { FaqInteractiveView } from "./FaqInteractiveView";
import styles from "./faq-page.module.css";

export function FaqPage() {
  return (
    <article className={styles.faqRoot}>
      <script dangerouslySetInnerHTML={{ __html: publicBreadcrumbJsonLd([
        { label: "Home", href: "/" }, { label: "Frequently asked questions", href: "/faq" },
      ]) }} type="application/ld+json" />
      <script dangerouslySetInnerHTML={{ __html: publicFaqJsonLd() }} type="application/ld+json" />
      <div className={styles.faqInner}>
        <Link href="/" className={styles.backLink}>← Back to KT Couriers</Link>
        <header className={styles.faqHero}>
          <div>
            <h1 className={styles.faqTitle}>Good questions. Clear answers.</h1>
            <p className={styles.faqLead}>Everything you need to know about sending a parcel, requesting a quote, checking coverage, managing an order or working with KT Couriers.</p>
          </div>
          <div className={styles.heroActions} aria-label="Common actions">
            <Link href="/quote">Get a delivery quote <span aria-hidden="true">↗</span></Link>
            <Link href="/track">Track a delivery <span aria-hidden="true">↗</span></Link>
          </div>
        </header>
        <FaqInteractiveView />
      </div>
    </article>
  );
}
