import { getLegalDocument, type LegalDocumentId } from "@/lib/public-legal/legal-document-registry";
import { LegalDocumentStatusNotice } from "./LegalDocumentStatus";
import { LegalTableOfContents, type LegalTableOfContentsItem } from "./LegalTableOfContents";
import styles from "./legal-pages.module.css";

export type LegalDocumentSection = LegalTableOfContentsItem & {
  paragraphs: readonly string[];
  bullets?: readonly string[];
};

type LegalDocumentPageProps = {
  documentId: LegalDocumentId;
  sections?: readonly LegalDocumentSection[];
};

/**
 * A server-rendered legal surface. Draft documents expose only their publication
 * state; sections render only after an approved source is supplied explicitly.
 */
export function LegalDocumentPage({ documentId, sections = [] }: LegalDocumentPageProps) {
  const document = getLegalDocument(documentId);
  const showSections = document.status === "APPROVED_FOR_PUBLICATION" && sections.length > 0;

  return (
    <article className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Legal and policy information</p>
          <h1 className={styles.title}>{document.title}</h1>
          <p className={styles.summary}>
            {showSections
              ? "This document is published from its approved source."
              : "Publication information is available here while the formal document is prepared."}
          </p>
        </div>
      </header>
      <div className={styles.body}>
        <div className={styles.bodyInner}>
          <LegalDocumentStatusNotice status={document.status} />
          {showSections ? <LegalTableOfContents items={sections} /> : null}
          {showSections ? (
            <div className={styles.sections}>
              {sections.map((section) => (
                <section className={styles.section} id={section.id} key={section.id}>
                  <h2>{section.heading}</h2>
                  {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                  {section.bullets?.length ? <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
                </section>
              ))}
            </div>
          ) : null}
          <p className={styles.footerNote}>
            No effective date, version, approving party, or legal contact is displayed until it is supplied by an approved source.
          </p>
        </div>
      </div>
    </article>
  );
}
