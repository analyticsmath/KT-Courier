import { describe, expect, it, vi } from "vitest";
import sitemap from "@/app/sitemap";
import { loadPublishedPolicy } from "@/lib/public-legal/published-policy";
vi.mock("next/server", () => ({ connection: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/public-legal/published-policy", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/public-legal/published-policy")>(),
  loadPublishedPolicy: vi.fn(),
}));
describe("effective policies in public sitemap", () => {
  it("includes published policies while excluding unavailable policies and private routes", async () => {
    vi.mocked(loadPublishedPolicy).mockImplementation(async (id) => id === "website-terms" ? { publicReference: "LEGAL-TEST", version: "v1", content: "Terms", contentHash: "hash", effectiveAt: new Date().toISOString() } : null);
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(urls).toContain("https://ktcouriers.com/terms");
    expect(urls).not.toContain("https://ktcouriers.com/privacy-policy");
    expect(urls).not.toContain("https://ktcouriers.com/refund-policy");
    expect(urls.some((url) => /\/account|\/checkout|\/cookie-policy/.test(url))).toBe(false);
  });
});
