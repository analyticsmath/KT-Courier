import type { LegalDocumentStatus } from "@/lib/public-legal/legal-document-registry";
import styles from "./legal-pages.module.css";

const statusCopy: Record<LegalDocumentStatus, { label: string; description: string }> = {
  MISSING: {
    label: "Publication not available",
    description: "This document has not been supplied for public publication.",
  },
  DRAFT_UNAPPROVED: {
    label: "Publication in preparation",
    description: "This document is being prepared for formal publication.",
  },
  COUNSEL_REVIEW_REQUIRED: {
    label: "Legal review required",
    description: "This document is being prepared for formal publication and requires legal review before it can be relied on as a published policy.",
  },
  APPROVED_FOR_PUBLICATION: {
    label: "Published document",
    description: "The approved document content appears below.",
  },
  SUPERSEDED: {
    label: "Superseded document",
    description: "This document is no longer presented as the current publication.",
  },
};

export function LegalDocumentStatusNotice({ status }: { status: LegalDocumentStatus }) {
  const copy = statusCopy[status];

  return (
    <section aria-label="Document publication status" className={styles.status}>
      <p className={styles.statusLabel}>{copy.label}</p>
      <p className={styles.statusText}>{copy.description}</p>
    </section>
  );
}
