import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export type LegalDocumentStatus =
  | "MISSING"
  | "DRAFT_UNAPPROVED"
  | "COUNSEL_REVIEW_REQUIRED"
  | "APPROVED_FOR_PUBLICATION"
  | "SUPERSEDED";

export type LegalDocumentId =
  | "privacy-notice"
  | "website-terms"
  | "cookie-notice"
  | "accessibility-statement"
  | "paia-manual";

export type LegalDocumentDefinition = {
  id: LegalDocumentId;
  route: `/${string}` | null;
  title: string;
  status: LegalDocumentStatus;
  version?: string;
  effectiveDate?: string;
  lastReviewedDate?: string;
  approvedBy?: string;
  contentSource?: string;
  indexable: boolean;
  sitemap: boolean;
  requiredInputs: readonly string[];
};

/**
 * Publication status is deliberately separate from product records and from
 * operational agreements. None of these entries has been approved by counsel
 * in the repository, so no effective date, version, approver, or legal clause
 * is manufactured here.
 */
export const legalDocumentRegistry: readonly LegalDocumentDefinition[] = [
  {
    id: "privacy-notice",
    route: "/privacy-policy",
    title: "Privacy Notice",
    status: "COUNSEL_REVIEW_REQUIRED",
    contentSource: "No approved public Privacy Notice source was found in the repository.",
    indexable: false,
    sitemap: false,
    requiredInputs: [
      "Approved Privacy Notice text",
      "Responsible legal entity identity",
      "Privacy contact authority",
      "Retention, legal-basis, recipient, and international-processing decisions",
    ],
  },
  {
    id: "website-terms",
    route: "/terms",
    title: "Website Terms",
    status: "COUNSEL_REVIEW_REQUIRED",
    contentSource: "No approved Website Terms source was found in the repository.",
    indexable: false,
    sitemap: false,
    requiredInputs: [
      "Approved Website Terms text and scope",
      "Responsible legal entity identity",
      "Approved contact route where one is required",
      "Confirmed separation from delivery, marketplace, participation, developer, payment, and refund agreements",
    ],
  },
  {
    id: "cookie-notice",
    route: "/cookie-policy",
    title: "Cookie Notice",
    status: "COUNSEL_REVIEW_REQUIRED",
    contentSource: "No approved Cookie Notice source was found in the repository.",
    indexable: false,
    sitemap: false,
    requiredInputs: [
      "Approved essential-cookie disclosure",
      "Cookie and browser-storage purpose review",
      "Confirmed non-essential tracking decision",
    ],
  },
  {
    id: "accessibility-statement",
    route: "/accessibility",
    title: "Accessibility Statement",
    status: "DRAFT_UNAPPROVED",
    contentSource: "No approved public accessibility statement source was found in the repository.",
    indexable: false,
    sitemap: false,
    requiredInputs: ["Approved accessibility statement", "Supported contact or feedback route", "Approved conformance wording, if any"],
  },
  {
    id: "paia-manual",
    route: null,
    title: "PAIA Manual / Access to Information",
    status: "MISSING",
    indexable: false,
    sitemap: false,
    requiredInputs: [
      "Approved PAIA Manual or approved access-to-information publication decision",
      "Legal entity and registration authority",
      "Information Officer and contact authority",
      "Approved records, procedure, form, fees, remedies, and document availability details where applicable",
    ],
  },
];

export function getLegalDocument(id: LegalDocumentId): LegalDocumentDefinition {
  const document = legalDocumentRegistry.find((candidate) => candidate.id === id);
  if (!document) throw new Error(`Unknown legal document: ${id}`);
  return document;
}

export function legalDocumentMetadata(id: Exclude<LegalDocumentId, "paia-manual">): Metadata {
  const document = getLegalDocument(id);
  if (!document.route) throw new Error(`Legal document ${id} has no published route.`);

  return publicPageMetadata({
    title: document.title,
    description: `${document.title} publication status for KT Couriers.`,
    route: document.route,
    noindex: document.status !== "APPROVED_FOR_PUBLICATION",
  });
}
