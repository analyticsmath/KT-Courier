import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolve } = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/services/legal-documents.service", () => ({
  resolveEffectiveLegalDocument: resolve,
}));

import { loadPublishedPolicy } from "@/lib/public-legal/published-policy";

const content = "PRIVACY POLICY\n1. INFORMATION\nWe protect your information.\n2. CONTACT\nsupport@ktcouriers.com";
const record = () => ({
  publicReference: "LEGAL-CLIENT-PRIVACY", documentType: "PRIVACY_NOTICE",
  version: "client-v1", jurisdiction: "ZA", publicationStatus: "PUBLISHED",
  effectiveAt: new Date("2026-08-09T00:00:00Z"), publishedAt: new Date("2026-08-09T00:00:00Z"),
  content, contentHash: createHash("sha256").update(content).digest("hex"),
  publishedByUserId: "private-operator-id", acceptancePolicy: "CURRENT_VERSION_REQUIRED",
});

describe("published public policies", () => {
  beforeEach(() => { resolve.mockReset(); });
  it("renders the exact effective canonical content and excludes operator fields", async () => {
    resolve.mockResolvedValue(record());
    const policy = await loadPublishedPolicy("privacy-notice");
    expect(policy?.content).toBe(content);
    expect(policy?.version).toBe("client-v1");
    expect(policy).not.toHaveProperty("publishedByUserId");
    expect(policy).not.toHaveProperty("acceptancePolicy");
    expect(resolve).toHaveBeenCalledWith("PRIVACY_NOTICE", expect.objectContaining({ jurisdiction: "ZA" }));
  });
  it("does not publish missing, draft, superseded or future-effective content", async () => {
    for (const value of [null, { ...record(), publicationStatus: "DRAFT" }, { ...record(), publicationStatus: "SUPERSEDED" }, { ...record(), effectiveAt: new Date("2099-01-01T00:00:00Z") }]) {
      resolve.mockResolvedValue(value);
      expect(await loadPublishedPolicy("privacy-notice")).toBeNull();
    }
  });
  it("rejects modified content rather than displaying it as the accepted policy", async () => {
    resolve.mockResolvedValue({ ...record(), content: content + " altered clause" });
    await expect(loadPublishedPolicy("privacy-notice")).rejects.toThrow("integrity");
  });
  it("does not substitute a different policy type or jurisdiction", async () => {
    resolve.mockResolvedValue({ ...record(), documentType: "TERMS_OF_SERVICE" });
    expect(await loadPublishedPolicy("privacy-notice")).toBeNull();
    resolve.mockResolvedValue({ ...record(), jurisdiction: "OTHER" });
    expect(await loadPublishedPolicy("privacy-notice")).toBeNull();
  });
});
