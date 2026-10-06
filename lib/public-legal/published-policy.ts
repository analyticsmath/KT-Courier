import { createHash } from "node:crypto";
import { resolveEffectiveLegalDocument } from "@/lib/services/legal-documents.service";

export const publicPolicyDefinitions = {
  "website-terms": { type: "TERMS_OF_SERVICE", title: "Terms and Conditions", route: "/terms" },
  "privacy-notice": { type: "PRIVACY_NOTICE", title: "Privacy Policy", route: "/privacy-policy" },
  "refund-policy": { type: "REFUND_POLICY", title: "Refund and Cancellation Policy", route: "/refund-policy" },
  "shipping-policy": { type: "SHIPPING_POLICY", title: "Shipping and Delivery Policy", route: "/shipping-policy" },
} as const;

export type PublicPolicyId = keyof typeof publicPolicyDefinitions;

/** Public pages use the same immutable version as the acceptance APIs. */
export async function loadPublishedPolicy(id: PublicPolicyId) {
  const definition = publicPolicyDefinitions[id];
  const at = new Date();
  const document = await resolveEffectiveLegalDocument(definition.type, { jurisdiction: "ZA", at });
  if (!document || document.publicationStatus !== "PUBLISHED" || document.documentType !== definition.type || document.jurisdiction !== "ZA") return null;
  const effectiveAt = new Date(document.effectiveAt);
  if (!Number.isFinite(effectiveAt.getTime()) || effectiveAt > at || typeof document.content !== "string" || !document.content.trim()) return null;
  if (createHash("sha256").update(document.content).digest("hex") !== document.contentHash) {
    throw new Error("Published policy integrity check failed.");
  }
  return {
    publicReference: String(document.publicReference),
    version: String(document.version),
    contentHash: String(document.contentHash),
    content: document.content,
    effectiveAt: effectiveAt.toISOString(),
  };
}
