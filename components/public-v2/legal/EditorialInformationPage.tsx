import Link from "next/link";
import styles from "./legal-pages.module.css";

export type EditorialInformationSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  points?: readonly string[];
};

export function EditorialInformationPage({
  title, introduction, note, highlights, sections, contactTitle, contactBody,
}: {
  title: string;
  introduction: string;
  note?: string;
  highlights: readonly { title: string; description: string }[];
  sections: readonly EditorialInformationSection[];
  contactTitle: string;
  contactBody: string;
}) {
  return <article className={styles.page}>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.backLink}>← Back to KT Couriers</Link>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.summary}>{introduction}</p>
      {note && <p className={styles.publicNote}>{note}</p>}
    </div></header>

    <div className={styles.body}><div className={styles.bodyInner}>
      <section className={styles.quickRead} aria-label="What to know">
        <div className={styles.quickHeader}>
          <h2>What to know</h2>
          <p>Key information before you continue.</p>
        </div>
        <div className={styles.quickGrid}>
          {highlights.map((item) => <div className={styles.quickItem} key={item.title}>
            <h3>{item.title}</h3><p>{item.description}</p>
          </div>)}
        </div>
      </section>

      <div className={styles.readingLayout}>
        <nav className={styles.readingNav} aria-label="On this page">
          <p className={styles.navHeading}>Contents</p>
          <ol>{sections.map((section) => <li key={section.id}>
            <a href={"#" + section.id}>{section.title}</a>
          </li>)}</ol>
        </nav>
        <div className={styles.documentColumn}>
          <div className={styles.policySections}>
            {sections.map((section) => <section className={styles.policySection} key={section.id} id={section.id}>
              <h2>{section.title}</h2>
              {section.paragraphs.map((text, i) => <p className={styles.documentParagraph} key={i}>{text}</p>)}
              {section.points && <ul className={styles.documentList}>{section.points.map((point) => <li key={point}>{point}</li>)}</ul>}
            </section>)}
          </div>
        </div>
      </div>
      <section className={styles.contactStrip} aria-label="Get assistance">
        <div><h2>{contactTitle}</h2><p>{contactBody}</p></div>
        <Link href="/contact">Contact the team <span aria-hidden="true">↗</span></Link>
      </section>
      <nav className={styles.relatedLinks} aria-label="Related information">
        <Link href="/faq">Help centre</Link>
        <Link href="/shipping-policy">Delivery policy</Link>
        <Link href="/privacy-policy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </div></div>
  </article>;
}
