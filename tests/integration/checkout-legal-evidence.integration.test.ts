import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { createLegalDocumentDraft, publishLegalDocumentVersion, retireLegalDocumentVersion } from "@/lib/services/legal-documents.service";
import { assertMarketplaceLegalEvidence, resolveMarketplaceLegalEvidence } from "@/lib/marketplace-checkout/legal-evidence";

describe("canonical checkout legal evidence on disposable PostgreSQL", () => {
  const prefix = `checkout-legal-${randomUUID()}`;
  let publisherId = ""; let termsReference = "";
  const drafts: Record<string, string> = {};
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/absent");
    if (process.env.NODE_ENV === "production" || process.env.KT_ALLOW_ISOLATED_POSTGRES_TESTS !== "1" || url.pathname !== "/kt_launch_test" || !["localhost", "127.0.0.1"].includes(url.hostname)) throw new Error("Disposable closure database required.");
    publisherId = (await prisma.user.create({ data: { email: `${prefix}@example.test`, role: "SUPER_ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() } })).id;
    for (const documentType of ["TERMS_OF_SERVICE", "PRIVACY_NOTICE", "REFUND_POLICY"]) {
      const document = await createLegalDocumentDraft({ actorUserId: publisherId, documentType, jurisdiction: "ZA", version: prefix, content: `Disposable ${documentType} fixture; this is not production legal approval.` });
      drafts[documentType] = String(document.publicReference);
    }
  });
  it("does not accept drafts as published checkout authority", async () => {
    await expect(resolveMarketplaceLegalEvidence()).rejects.toMatchObject({ code: "CHECKOUT_LEGAL_BLOCKED" });
  });
  it("resolves actual domain-published versions and rejects fabricated references", async () => {
    for (const documentType of Object.keys(drafts)) await publishLegalDocumentVersion({ actorUserId: publisherId, publicReference: drafts[documentType], operationId: `${prefix}-${documentType}`, effectiveAt: new Date("2026-01-01") });
    const evidence = await prisma.$transaction((tx) => resolveMarketplaceLegalEvidence(tx)); termsReference = evidence.termsVersion;
    expect(evidence.termsVersion).toMatch(new RegExp(`^${drafts.TERMS_OF_SERVICE}:[a-f0-9]{64}$`));
    expect(evidence.privacyVersion).toMatch(new RegExp(`^${drafts.PRIVACY_NOTICE}:[a-f0-9]{64}$`));
    expect(evidence.refundPolicyReferences).toHaveLength(1);
    expect(() => assertMarketplaceLegalEvidence({ ...evidence, termsVersion: "terms-2026-v1" }, evidence)).toThrow(expect.objectContaining({ code: "CHECKOUT_CHANGES_UNACKNOWLEDGED" }));
  });
  it("rejects superseded accepted references and retirement without changing historical evidence", async () => {
    const next = await createLegalDocumentDraft({ actorUserId: publisherId, documentType: "TERMS_OF_SERVICE", jurisdiction: "ZA", version: `${prefix}-next`, content: "Disposable successor terms; no production approval implied." });
    await publishLegalDocumentVersion({ actorUserId: publisherId, publicReference: String(next.publicReference), operationId: `${prefix}-next`, effectiveAt: new Date() });
    const current = await resolveMarketplaceLegalEvidence();
    expect(current.termsVersion).not.toBe(termsReference);
    expect(() => assertMarketplaceLegalEvidence({ ...current, termsVersion: termsReference }, current)).toThrow(expect.objectContaining({ code: "CHECKOUT_CHANGES_UNACKNOWLEDGED" }));
    await retireLegalDocumentVersion({ actorUserId: publisherId, publicReference: String(next.publicReference), operationId: `${prefix}-retire` });
    await expect(resolveMarketplaceLegalEvidence()).rejects.toMatchObject({ code: "CHECKOUT_LEGAL_BLOCKED" });
    expect(await prisma.legalDocumentVersion.findUnique({ where: { publicReference: drafts.TERMS_OF_SERVICE } })).toMatchObject({ publicationStatus: "SUPERSEDED" });
    // Published fixture and audit evidence survive until the disposable database
    // is destroyed; the suite does not delete or rewrite legal history.
  });
});
