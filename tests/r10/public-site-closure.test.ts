import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import robots from "@/app/robots";
import { brandAssets } from "@/lib/public-assets/brand-assets";
import { legalDocumentRegistry } from "@/lib/public-legal/legal-document-registry";
import { publicRouteRegistry, sitemapPublicRoutes } from "@/lib/public-site/public-route-registry";
import { canonicalSiteOrigin, canonicalUrl } from "@/lib/public-site/site-origin";
import { publicPageMetadata, publicSiteMetadata } from "@/lib/public-site/site-metadata";

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

function knownPublicRoute(href: string): boolean {
  const path = href.split("#", 1)[0] || "/";
  return publicRouteRegistry.some((route) => {
    if (route.route === path) return true;
    if (!route.route.endsWith("/*")) return false;
    return path.startsWith(route.route.slice(0, -1));
  });
}

describe("R10 legal publication gate", () => {
  it("registers every current legal route and does not self-approve a document", () => {
    expect(legalDocumentRegistry.map((document) => document.route)).toEqual(expect.arrayContaining([
      "/privacy-policy",
      "/terms",
      "/cookie-policy",
      "/accessibility",
    ]));
    expect(legalDocumentRegistry.some((document) => document.status === "APPROVED_FOR_PUBLICATION")).toBe(false);
    expect(legalDocumentRegistry.every((document) => document.effectiveDate === undefined && document.approvedBy === undefined)).toBe(true);
  });

  it("keeps unapproved legal documents noindex and outside the sitemap", () => {
    const unapproved = legalDocumentRegistry.filter((document) => document.status !== "APPROVED_FOR_PUBLICATION");
    expect(unapproved.every((document) => !document.indexable && !document.sitemap)).toBe(true);
    expect(sitemapPublicRoutes.some((route) => route.family === "LEGAL")).toBe(false);
  });

  it("does not leave generated legal placeholder copy in current legal routes", () => {
    for (const route of ["privacy-policy", "terms", "cookie-policy", "accessibility"]) {
      const source = read(`app/(public)/${route}/page.tsx`);
      expect(source).toContain("LegalDocumentPage");
      expect(source).not.toMatch(/lastUpdated|placeholder|retention period|liability cap|refund period/i);
    }
  });
});

describe("R10 metadata and sitemap contracts", () => {
  it("uses one validated canonical origin without localhost, queries, or fragments", () => {
    expect(canonicalSiteOrigin.protocol).toBe("https:");
    expect(canonicalSiteOrigin.hostname).not.toMatch(/localhost|127\.0\.0\.1|vercel\.app/i);
    expect(canonicalUrl("/services?utm_source=x#top")).toBe("https://ktcouriers.com/services");
    expect(() => canonicalUrl("services")).toThrow();
  });

  it("gives public metadata a canonical, complete social card, and one brand suffix", () => {
    const metadata = publicPageMetadata({ title: "Example route", description: "Example description", route: "/example" });
    expect(metadata.title).toBe("Example route");
    expect(metadata.alternates).toEqual({ canonical: "/example" });
    expect(metadata.openGraph).toMatchObject({ images: [publicSiteMetadata.defaultOpenGraphImage], url: "/example" });
    expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
    expect(`${metadata.openGraph?.title}`).toBe("Example route | KT Couriers");
  });

  it("does not duplicate the inherited brand suffix in public or auth metadata", () => {
    const sources = [
      "app/(public)/membership/checkout/page.tsx",
      "app/(auth)/login/page.tsx",
      "app/(auth)/signup/page.tsx",
      "app/(auth)/verify-otp/page.tsx",
    ].map(read).join("\n");
    expect(sources).not.toMatch(/title:\s*["`][^"`]*\|\s*KT Couriers/);
  });

  it("keeps the root sitemap aligned with the typed indexable route policy", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(sitemapPublicRoutes.map((route) => canonicalUrl(route.route)));
    expect(urls.every((url) => !/[?#]/.test(url) && !/localhost|vercel\.app/i.test(url))).toBe(true);
    expect(urls.some((url) => /\/(login|account|cart|checkout|privacy-policy|terms)(\/|$)/.test(url))).toBe(false);
  });

  it("keeps robots pointed at canonical sitemap URLs without blocking included routes", () => {
    const policy = robots();
    expect(policy.sitemap).toEqual([canonicalUrl("/sitemap.xml"), canonicalUrl("/shop/sitemap.xml")]);
    const rules = Array.isArray(policy.rules) ? policy.rules : [policy.rules];
    const disallow = rules[0]?.disallow ?? [];
    const values = Array.isArray(disallow) ? disallow : [disallow];
    expect(sitemapPublicRoutes.every((route) => !values.some((entry) => route.route.startsWith(entry)))).toBe(true);
  });
});

describe("R10 brand assets and public-link contracts", () => {
  it("has the required Next metadata route sources and a local default social asset", () => {
    for (const path of ["app/icon.tsx", "app/apple-icon.tsx", "app/opengraph-image.tsx", "app/manifest.ts", "app/favicon.ico", "public/images/kt-couriers/brand/logo.svg"]) {
      expect(existsSync(resolve(root, path))).toBe(true);
    }
    expect(read("app/opengraph-image.tsx")).toContain("width: 1200");
    expect(read("app/opengraph-image.tsx")).toContain("height: 630");
    expect(read("app/manifest.ts")).toContain('display: "browser"');
    expect(read("app/manifest.ts")).not.toMatch(/standalone|serviceWorker|push/i);
    expect(brandAssets.every((asset) => asset.path.startsWith("/") && !asset.path.startsWith("//"))).toBe(true);
  });

  it("makes the text wordmark accessible and keeps compact-mark details decorative", () => {
    const wordmark = read("components/public-v2/brand/KtCouriersWordmark.tsx");
    const mark = read("components/public-v2/brand/KtCouriersMark.tsx");
    expect(wordmark).toContain("KT Couriers");
    expect(mark).toContain("aria-hidden");
    expect(mark).not.toContain("®");
  });

  it("keeps header and footer links public, guarded, and free of placeholder URLs", () => {
    const source = `${read("components/public-v2/site/PublicHeaderV2.tsx")}\n${read("components/public-v2/site/PublicFooterV2.tsx")}\n${read("components/public-v2/site/PublicNavigation.tsx")}`;
    expect(source).not.toMatch(/href=\"#\"|javascript:/i);
    const hrefs = [...source.matchAll(/href:\s*["']([^"']+)["']|href=["']([^"']+)["']/g)]
      .map((match) => match[1] ?? match[2]);
    expect(hrefs.every(knownPublicRoute)).toBe(true);
  });
});
