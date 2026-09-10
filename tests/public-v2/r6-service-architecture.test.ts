import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { allServiceMedia } from "@/lib/public-assets/service-media";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";
import { publicServicePages } from "@/lib/public-services/service-page-registry";
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
      expect(readSource(file)).toContain("metadata");
    }
  });

  it("verifies public-shell CSS module contract and Service Index Plane class synchronization", () => {
    const atlasSource = readSource("components/public-v2/site/ServicesAtlasMenu.tsx");
    const shellCssSource = readSource("components/public-v2/site/public-shell.module.css");

    // Extract all styles.<className> usages from ServicesAtlasMenu
    const classMatches = [...atlasSource.matchAll(/styles\.([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
    expect(classMatches.length).toBeGreaterThan(5);

    // Every single CSS class in ServicesAtlasMenu must exist in public-shell.module.css
    for (const className of classMatches) {
      expect(shellCssSource).toContain(`.${className}`);
    }

    // Obsolete class names must not exist in public-shell.module.css
    expect(shellCssSource).not.toContain(".atlasOverlay");
    expect(shellCssSource).not.toContain(".atlasDrawer");
    expect(shellCssSource).not.toContain(".atlasIndexColumn");
    expect(shellCssSource).not.toContain(".atlasHeaderRow");
  });

  it("enforces media completeness and single canonical quote path without inline calculators", () => {
    expect(Object.keys(allServiceMedia)).toHaveLength(11);
    for (const item of Object.values(allServiceMedia)) {
      expect(existsSync(path.join(publicRoot, item.src.replace(/^\//, "")))).toBe(true);
      expect(item.alt.length).toBeGreaterThan(10);
    }

    expect(detailSource).toContain(quotePath);
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
    expect(dependencies.filter((name) => /framer|lottie|three/i.test(name))).toEqual([]);
    expect(registrySource).not.toMatch(/\/account\/request-delivery\?/);
    expect(detailSource).not.toContain("<form");
  });
});
