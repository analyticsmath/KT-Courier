import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { MarketplaceCheckoutError } from "./errors";

export type MarketplaceLegalEvidence = Readonly<{ termsVersion: string; privacyVersion: string; refundPolicyReferences: readonly string[] }>;
type LegalDatabase = Pick<Prisma.TransactionClient, "legalDocumentVersion">;

/** References bind acceptance to the same effective, immutable content shown publicly. */
export async function resolveMarketplaceLegalEvidence(db: LegalDatabase = prisma, at = new Date()): Promise<MarketplaceLegalEvidence> {
  const references = await Promise.all(["TERMS_OF_SERVICE", "PRIVACY_NOTICE", "REFUND_POLICY"].map(async (documentType) => {
    const document = await db.legalDocumentVersion.findFirst({ where: { documentType, jurisdiction: "ZA", publicationStatus: "PUBLISHED", effectiveAt: { lte: at } }, orderBy: [{ effectiveAt: "desc" }, { publishedAt: "desc" }], select: { publicReference: true, content: true, contentHash: true, publishedAt: true, publishedByUserId: true } });
    if (!document || !document.publishedAt || document.publishedAt > at || !document.publishedByUserId || !document.content?.trim() || createHash("sha256").update(document.content).digest("hex") !== document.contentHash) throw new MarketplaceCheckoutError("CHECKOUT_LEGAL_BLOCKED", "Checkout policies are awaiting publication or verification. Please try again when they are available.");
    return `${document.publicReference}:${document.contentHash}`;
  }));
  return Object.freeze({ termsVersion: references[0], privacyVersion: references[1], refundPolicyReferences: Object.freeze([references[2]]) });
}

export function assertMarketplaceLegalEvidence(supplied: MarketplaceLegalEvidence, current: MarketplaceLegalEvidence): void {
  if (supplied.termsVersion !== current.termsVersion || supplied.privacyVersion !== current.privacyVersion || supplied.refundPolicyReferences.length !== current.refundPolicyReferences.length || supplied.refundPolicyReferences.some((reference, index) => reference !== current.refundPolicyReferences[index])) throw new MarketplaceCheckoutError("CHECKOUT_CHANGES_UNACKNOWLEDGED", "Checkout policies changed. Review the current published versions and try again.");
}
