import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/public-site/site-metadata";

export type LegalDocumentStatus =
  | "MISSING"
  | "DRAFT_UNAPPROVED"
  | "COUNSEL_REVIEW_REQUIRED"
  | "APPROVED_FOR_PUBLICATION"
  | "DATABASE_MANAGED"
  | "SUPERSEDED";

export type LegalDocumentId =
  | "privacy-notice"
  | "website-terms"
  | "refund-policy"
  | "shipping-policy"
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
 * operational agreements. Supplied client policies resolve publication from
 * immutable database versions. Remaining documents retain their review gates;
 * this static registry does not manufacture counsel approval or effective dates.
 */
export const legalDocumentRegistry: readonly LegalDocumentDefinition[] = [
  {
    id: "privacy-notice",
    route: "/privacy-policy",
    title: "Privacy Notice",
    status: "DATABASE_MANAGED",
    contentSource: "Client Privacy Policy; effective immutable version resolved from LegalDocumentVersion.",
    indexable: false,
    sitemap: false,
    requiredInputs: [],
  },
  {
    id: "website-terms",
    route: "/terms",
    title: "Website Terms",
    status: "DATABASE_MANAGED",
    contentSource: "Client Terms reconciled against later instructions; effective immutable version resolved from LegalDocumentVersion.",
    indexable: false,
    sitemap: false,
    requiredInputs: [],
  },
  {
    id: "refund-policy", route: "/refund-policy", title: "Refund and Cancellation Policy",
    status: "DATABASE_MANAGED", contentSource: "Client Refund Policy; effective immutable version resolved from LegalDocumentVersion.",
    indexable: false, sitemap: false, requiredInputs: [],
  },
  {
    id: "shipping-policy", route: "/shipping-policy", title: "Shipping and Delivery Policy",
    status: "DATABASE_MANAGED", contentSource: "Client Shipping Policy; effective immutable version resolved from LegalDocumentVersion.",
    indexable: false, sitemap: false, requiredInputs: [],
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
