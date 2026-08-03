import Link from "next/link";
import styles from "./homepage-v2.module.css";

export type HomepageFaqItem = {
  question: string;
  answer: string;
};

export function HomepageFaq({ items }: { items: readonly HomepageFaqItem[] }) {
  return (
    <section aria-labelledby="homepage-faq-heading" className={styles.faqSection}>
      <div className={styles.sectionInner}>
        <div className={styles.faqHeading}>
          <p className={styles.sectionMarker}>FAQ</p>
          <h2 id="homepage-faq-heading">Answers before the first delivery.</h2>
        </div>
        <div className={styles.faqList}>
          {items.map((item) => (
            <details key={item.question}>
              <summary>{item.question}<span aria-hidden="true">+</span></summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
        <Link className={styles.textAction} href="/faq">View all questions <span aria-hidden="true">→</span></Link>
      </div>
    </section>
  );
}
