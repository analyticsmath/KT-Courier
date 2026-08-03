import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allServiceMedia } from "@/lib/public-assets/service-media";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import {
  indexablePublicServicePages,
  publicServicePages,
} from "@/lib/public-services/service-page-registry";
import sitemap from "@/app/sitemap";

const workspaceRoot = process.cwd();
const publicRoot = path.join(workspaceRoot, "public");
const quotePath = "/account/request-delivery";
const expectedRoutes = [
  "/services/parcel",
  "/services/ecommerce",
  "/services/food",
  "/services/grocery",
  "/services/pharmacy",
  "/services/moving",
  "/services/freight",
  "/services/shuttle",
  "/services/business",
  "/services/driver-network",
  "/services/pricing",
] as const;

const readSource = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");
const routeSources = expectedRoutes.map((route) => ({
  route,
  file: `app/(public)${route}/page.tsx`,
}));
const serviceComponentSources = [
  "components/public-v2/services/ServiceDetailPage.tsx",
  "components/public-v2/services/ServicesOverviewPage.tsx",
  "components/public-v2/services/ServiceNarrative.tsx",
  "components/public-v2/services/ServiceCoverage.tsx",
].map(readSource);
const registrySource = readSource("lib/public-services/service-page-registry.ts");
const detailSource = readSource("components/public-v2/services/ServiceDetailPage.tsx");
const breadcrumbSource = readSource("components/public-v2/navigation/PublicBreadcrumbs.tsx");
const coverageSource = readSource("components/public-v2/services/ServiceCoverage.tsx");
const sitemapSource = readSource("app/sitemap.ts");
const cssSource = readSource("components/public-v2/services/service-pages.module.css");
const packageJson = JSON.parse(readSource("package.json")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

describe("R6 public service architecture", () => {
  it("preserves the verified eleven-route inventory with unique identities and files", () => {
    expect(publicServicePages).toHaveLength(11);
    expect(publicServicePages.map((service) => service.route)).toEqual(expectedRoutes);
    expect(new Set(publicServicePages.map((service) => service.id)).size).toBe(11);
    expect(new Set(publicServicePages.map((service) => service.slug)).size).toBe(11);

    for (const { file } of routeSources) {
      expect(existsSync(path.join(workspaceRoot, file))).toBe(true);
      expect(readSource(file)).toContain("ServiceDetailPage");
      expect(readSource(file)).toContain("publicServiceMetadata");
    }
  });

  it("keeps unique, canonical, indexable metadata and one factual action per service", () => {
    expect(indexablePublicServicePages).toHaveLength(11);
    expect(new Set(publicServicePages.map((service) => service.metadataTitle)).size).toBe(11);
    expect(new Set(publicServicePages.map((service) => service.metadataDescription)).size).toBe(11);

    for (const service of publicServicePages) {
      expect(service.route).toBe(`/services/${service.slug}`);
      expect(service.primaryAction.label.trim()).not.toBe("");
      expect(service.heroMediaId).toBeTruthy();
      expect(service.detailMediaIds.length).toBeGreaterThan(0);
    }

    for (const service of publicServicePages.filter((candidate) => candidate.primaryActionIsQuote)) {
      expect(service.primaryAction).toEqual(expect.objectContaining({ href: quotePath }));
    }

    const driverNetwork = publicServicePages.find((service) => service.id === "driver-network");
    expect(driverNetwork).toEqual(expect.objectContaining({
      primaryAction: { label: "Contact support", href: "/contact" },
      primaryActionIsQuote: false,
    }));
    expect(driverNetwork?.restrictions.join(" ")).toMatch(/does not provide an open public enrolment/i);
  });

  it("keeps media local, provisional, dimensioned, meaningful, and replaceable", () => {
    expect(allServiceMedia).toHaveLength(11);

    for (const media of allServiceMedia) {
      expect(media.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(media.src).not.toMatch(/^https?:\/\//);
      expect(media.width).toBeGreaterThan(0);
      expect(media.height).toBeGreaterThan(0);
      expect(media.format).toBe("webp");
      expect(media.sourceLedgerReference).toMatch(/^#/);
      expect(media.status).toMatch(/^PROVISIONAL_R[24]$/);
      expect(media.status).not.toMatch(/FINAL/);
      expect(media.provisional).toBe(true);
      expect(media.visibleBrandReview.trim()).not.toBe("");
      expect(media.replacementPriority).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      expect(existsSync(path.join(publicRoot, media.src))).toBe(true);
      if (!media.decorative) expect(media.alt.trim()).not.toBe("");
    }
  });

  it("keeps related routes real and avoids public tracking, invented rates, times, and coverage scope", () => {
    for (const service of publicServicePages) {
      expect(service.relatedServiceIds).not.toContain(service.id);
      for (const relatedId of service.relatedServiceIds) {
        expect(publicServicePages.some((candidate) => candidate.id === relatedId)).toBe(true);
      }
      expect(service.primaryAction.href).not.toMatch(/track/i);
      expect(service.secondaryAction?.href ?? "").not.toMatch(/track/i);
    }

    const serviceSource = [...serviceComponentSources, registrySource].join("\n");
    expect(serviceSource).not.toMatch(/\bfrom\s+R\s*\d/i);
    expect(serviceSource).not.toMatch(/\bR\s*\d+(?:,\d{3})*(?:\.\d{2})?\s+(?:per|each|only|for)\b/i);
    expect(serviceSource).not.toMatch(/\b\d+\s*(?:min(?:ute)?s?|hours?|hrs?)\b/i);
    expect(serviceSource).not.toMatch(/\bsame[- ]day\b/i);
    expect(serviceSource).not.toMatch(/\bnationwide\b/i);
    expect(serviceSource).not.toMatch(/temperature[- ]controlled|cold[- ]chain|fully insured|guaranteed/i);
  });

  it("uses accessible server-first primitives without a client calculator or page-level motion", () => {
    expect(detailSource).toContain("<h1");
    expect(detailSource).toContain("<details");
    expect(breadcrumbSource).toContain('aria-label="Breadcrumb"');
    expect(breadcrumbSource).toContain("<ol>");
    expect(breadcrumbSource).toContain('aria-current="page"');
    expect(coverageSource).toContain("listDeliveryRegions(true)");
    expect(coverageSource).toContain("catch");

    for (const source of serviceComponentSources) {
      expect(source).not.toContain('"use client"');
      expect(source).not.toMatch(/from ["']gsap|ScrollTrigger|\bpin\s*:/i);
    }

    expect(existsSync(path.join(workspaceRoot, "app/(public)/services/pricing/PricingCalculator.tsx"))).toBe(false);
    expect(routeSources.find((route) => route.route === "/services/pricing")).toBeDefined();
    expect(readSource("app/(public)/services/pricing/page.tsx")).not.toMatch(/Calculator|use client/i);
    expect(cssSource).toContain("prefers-reduced-motion");
    expect(cssSource).toContain("forced-colors");
    expect(cssSource).not.toMatch(/gradient|purple|box-shadow/i);
  });

  it("keeps breadcrumb JSON-LD limited to the canonical hierarchy and sitemap limited to public services", () => {
    const jsonLd = JSON.parse(publicBreadcrumbJsonLd([
      { label: "Home", href: "/" },
      { label: "Services", href: "/services" },
      { label: "Parcel and document delivery", href: "/services/parcel" },
    ]));
    expect(jsonLd["@type"]).toBe("BreadcrumbList");
    expect(jsonLd.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      "https://ktcouriers.com/",
      "https://ktcouriers.com/services",
      "https://ktcouriers.com/services/parcel",
    ]);

    expect(sitemapSource).toContain("indexablePublicServicePages");
    const sitemapEntries = sitemap();
    const serviceUrls = sitemapEntries.filter((entry) => entry.url.includes("/services")).map((entry) => entry.url);
    expect(serviceUrls).toEqual([
      "https://ktcouriers.com/services",
      ...expectedRoutes.map((route) => `https://ktcouriers.com${route}`),
    ]);
    expect(sitemapEntries.some((entry) => entry.url.includes("/account/"))).toBe(false);
  });

  it("adds no dependency or alternate public service form", () => {
    const dependencies = Object.keys({ ...packageJson.dependencies, ...packageJson.devDependencies });
    expect(dependencies.filter((name) => /framer|lenis|lottie|three/i.test(name))).toEqual([]);
    expect(registrySource).not.toMatch(/\/account\/request-delivery\?/);
    expect(detailSource).not.toContain("<form");
  });
});
