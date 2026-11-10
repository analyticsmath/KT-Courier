import { z } from "zod";
import { PlatformError } from "@/lib/client-platform/contracts";

const text = (min: number, max: number) => z.string().trim().min(min).max(max).refine(value => !/[<>\u0000-\u001f]/.test(value), "Use plain text.");
const optionalText = text(1, 160).nullable().optional();

export const CANONICAL_SELLER_EVIDENCE_MESSAGE =
  "Upload your verification document first, then use the automatically generated reference.";

const CANONICAL_SELLER_EVIDENCE_PATTERN =
  /^(PMO-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|EXT-[A-Za-z0-9_-]{4,120}|EXISTING_REVIEWED_EVIDENCE)$/;

export const ExternalSellerEvidenceSchema = z
  .object({
    schemaVersion: z.literal(1),
    reference: z.string().regex(/^EXT-[A-Za-z0-9_-]{4,120}$/),
    storeId: text(1, 160),
    status: z.literal("REVIEWED"),
    authorizedByUserId: text(1, 160),
    documentDigest: text(16, 240),
  })
  .strict();

export type ExternalSellerEvidenceRecord = z.infer<typeof ExternalSellerEvidenceSchema>;

export function isCanonicalSellerEvidenceReference(value: string): boolean {
  return CANONICAL_SELLER_EVIDENCE_PATTERN.test(value.trim());
}

export function assertCanonicalSellerEvidenceReference(
  value: string,
  options?: { expectedIdentityReference?: string | null },
): void {
  const normalized = value.trim();
  if (!isCanonicalSellerEvidenceReference(normalized)) {
    throw new PlatformError("SELLER_EVIDENCE_INVALID", CANONICAL_SELLER_EVIDENCE_MESSAGE, 422);
  }
  if (
    normalized === "EXISTING_REVIEWED_EVIDENCE" &&
    options !== undefined &&
    !options.expectedIdentityReference
  ) {
    throw new PlatformError("SELLER_EVIDENCE_INVALID", CANONICAL_SELLER_EVIDENCE_MESSAGE, 422);
  }
}

export function suggestSellerIdentityVersion(rawName: string, versionNumber = 1): string {
  const cleaned = rawName
    .trim()
    .replace(/['’`]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 68)
    .replace(/_+$/g, "");
  if (!cleaned) return "";
  if (/_V\d+$/.test(cleaned)) return cleaned;
  return `${cleaned}_V${Math.max(1, Math.trunc(versionNumber))}`;
}

export const StoreSellerIdentityProposalSchema = z.object({
  operationId: text(8, 100).regex(/^[A-Za-z0-9:_-]+$/),
  expectedIdentityReference: text(1, 160).nullable(),
  identityVersion: text(1, 80).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, "Use letters and numbers, underscores, periods or hyphens, without spaces. Example: PAMMY_BAKES_V1."),
  legalName: text(2, 240), tradingName: optionalText, registrationReference: optionalText,
  vatRegistrationStatus: z.enum(["REGISTERED", "NOT_REGISTERED"]), vatNumber: optionalText,
  countryCode: z.literal("ZA"), termsReference: optionalText,
  invoiceClassification: z.enum(["RECEIPT", "TAX_INVOICE"]),
  effectiveFrom: z.string().datetime(), effectiveUntil: z.string().datetime().nullable(),
  sourceEvidenceReference: text(8, 240), confirmSuppliedDetails: z.literal(true),
}).strict().superRefine((data, context) => {
  if (data.vatRegistrationStatus === "REGISTERED" && !data.vatNumber) context.addIssue({ code: "custom", path: ["vatNumber"], message: "Supply the reviewed VAT reference." });
  if (data.vatRegistrationStatus !== "REGISTERED" && (data.vatNumber || data.invoiceClassification === "TAX_INVOICE")) context.addIssue({ code: "custom", path: ["invoiceClassification"], message: "Tax-invoice classification requires registered VAT evidence." });
  if (data.effectiveUntil && new Date(data.effectiveUntil) <= new Date(data.effectiveFrom)) context.addIssue({ code: "custom", path: ["effectiveUntil"], message: "The effective window must end after it starts." });
});
export const StoreSellerIdentityReviewSchema = z.object({
  proposalReference: text(8, 100), expectedUpdatedAt: z.string().datetime(),
  operationId: text(8, 100).regex(/^[A-Za-z0-9:_-]+$/),
  action: z.enum(["APPROVE", "REJECT"]), reason: text(8, 240),
  evidenceReference: text(8, 240), confirmIndependentReview: z.literal(true),
}).strict();
export type SellerIdentityProposalInput = z.infer<typeof StoreSellerIdentityProposalSchema>;
export type SellerIdentityReviewInput = z.infer<typeof StoreSellerIdentityReviewSchema>;
