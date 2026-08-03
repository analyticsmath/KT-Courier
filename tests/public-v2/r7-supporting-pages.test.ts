import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import aboutMetadata from "@/app/(public)/about/page";
import { metadata as aboutPageMetadata } from "@/app/(public)/about/page";
import { metadata as careersPageMetadata } from "@/app/(public)/careers/page";
import { metadata as contactPageMetadata } from "@/app/(public)/contact/page";
import { metadata as coveragePageMetadata } from "@/app/(public)/coverage-areas/page";
import { metadata as faqPageMetadata } from "@/app/(public)/faq/page";
import { metadata as membershipPageMetadata } from "@/app/(public)/membership/page";
import sitemap from "@/app/sitemap";
import { allSupportingPageMedia } from "@/lib/public-assets/supporting-page-media";
import { publicFaqJsonLd, publicFaqSections } from "@/lib/public-faq/faqs";
import { publicBreadcrumbJsonLd } from "@/lib/public-services/public-breadcrumb-json-ld";

const workspaceRoot = process.cwd();
const publicRoot = path.join(workspaceRoot, "public");
const readSource = (file: string) => readFileSync(path.join(workspaceRoot, file), "utf8");
const routeFiles = [
  "app/(public)/about/page.tsx",
  "app/(public)/coverage-areas/page.tsx",
  "app/(public)/membership/page.tsx",
  "app/(public)/careers/page.tsx",
  "app/(public)/faq/page.tsx",
  "app/(public)/contact/page.tsx",
] as const;
const routeSources = routeFiles.map(readSource);
const pageComponentSources = [
  "components/public-v2/about/AboutPage.tsx",
  "components/public-v2/coverage/CoveragePage.tsx",
  "components/public-v2/membership/MembershipPage.tsx",
  "components/public-v2/careers/CareersPage.tsx",
  "components/public-v2/faq/FaqPage.tsx",
  "components/public-v2/contact/ContactPage.tsx",
].map(readSource);
const supportCss = readSource("components/public-v2/support/support-pages.module.css");

function titleText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "absolute" in value && typeof value.absolute === "string") return value.absolute;
  return "";
}

describe("R7 supporting public pages", () => {
  it("preserves the six canonical route files with unique metadata", () => {
    for (const file of routeFiles) expect(existsSync(path.join(workspaceRoot, file))).toBe(true);
    expect(aboutMetadata).toBeTypeOf("function");

    const metadata = [aboutPageMetadata, coveragePageMetadata, membershipPageMetadata, careersPageMetadata, faqPageMetadata, contactPageMetadata];
    const titles = metadata.map((item) => titleText(item.title));
    const descriptions = metadata.map((item) => item.description);
    const canonicals = metadata.map((item) => item.alternates?.canonical);

    expect(new Set(titles).size).toBe(6);
    expect(new Set(descriptions).size).toBe(6);
    expect(canonicals).toEqual(["/about", "/coverage-areas", "/membership", "/careers", "/faq", "/contact"]);
  });

  it("keeps breadcrumbs and sitemap entries limited to canonical public routes", () => {
    const breadcrumb = JSON.parse(publicBreadcrumbJsonLd([{ label: "Home", href: "/" }, { label: "Coverage areas", href: "/coverage-areas" }]));
    expect(breadcrumb.itemListElement.map((item: { item: string }) => item.item)).toEqual([
      "https://ktcouriers.com/",
      "https://ktcouriers.com/coverage-areas",
    ]);

    const urls = sitemap().map((entry) => entry.url);
    for (const route of ["/about", "/coverage-areas", "/membership", "/careers", "/faq", "/contact"]) {
      expect(urls).toContain(`https://ktcouriers.com${route}`);
    }
    expect(urls.some((url) => /\/account\/|\/applicant\//.test(url))).toBe(false);
  });

  it("uses the active-region source and retains distinct honest coverage states", () => {
    const coverageDataSource = readSource("lib/public-coverage/coverage.ts");
    const coverageComponent = readSource("components/public-v2/coverage/CoveragePage.tsx");

    expect(coverageDataSource).toContain("listDeliveryRegions(true)");
    expect(coverageDataSource).toContain('"ACTIVE_REGIONS"');
    expect(coverageDataSource).toContain('"EMPTY_CONFIGURATION"');
    expect(coverageDataSource).toContain('"SOURCE_UNAVAILABLE"');
    expect(coverageComponent).not.toMatch(/nationwide|latitude|longitude/i);
    expect(coverageComponent).toContain("There is no postcode checker");
    expect(coverageComponent).toContain("live driver location");
    expect(coverageComponent).toContain("does not treat an unavailable source as an empty coverage list");
  });

  it("does not turn membership into an unsupported public purchase flow", () => {
    const membership = readSource("components/public-v2/membership/MembershipPage.tsx");
    const checkout = readSource("app/(public)/membership/checkout/page.tsx");

    expect(membership).toContain("Information only");
    expect(membership).toContain("No public plan activation or purchase route is offered");
    expect(membership).not.toMatch(/subscribe now|join now|buy membership|discounted deliver|priority deliver|free deliver/i);
    expect(checkout).toContain("checkout is not currently available");
    expect(checkout).not.toMatch(/support@|tel:|mailto:/i);
  });

  it("reads careers from published-opening authority and never invents a role or salary", () => {
    const careersDataSource = readSource("lib/public-careers/openings.ts");
    const careersComponent = readSource("components/public-v2/careers/CareersPage.tsx");

    expect(careersDataSource).toContain("OpeningService");
    expect(careersDataSource).toContain("getPublicOpenings");
    expect(careersComponent).toContain("No published openings");
    expect(careersComponent).toContain("SOURCE_UNAVAILABLE");
    expect(careersComponent).not.toMatch(/salary|benefits|always hiring|guaranteed response|JobPosting/i);
  });

  it("uses one server-side FAQ source for visible native disclosures and schema", () => {
    const faqComponent = readSource("components/public-v2/faq/FaqPage.tsx");
    const faqSchema = JSON.parse(publicFaqJsonLd());
    const visibleQuestions = publicFaqSections.flatMap((section) => section.items.map((item) => item.question));

    expect(readSource("lib/public-faq/faqs.ts")).toContain("serviceFaqs");
    expect(faqComponent).toContain("<details");
    expect(faqComponent).toContain("<summary>");
    expect(faqComponent).not.toContain('"use client"');
    expect(faqSchema["@type"]).toBe("FAQPage");
    expect(faqSchema.mainEntity.map((item: { name: string }) => item.name)).toEqual(visibleQuestions);
  });

  it("keeps the contact page on the canonical form and server contract", () => {
    const contactPage = readSource("components/public-v2/contact/ContactPage.tsx");
    const form = readSource("components/forms/ContactForm.tsx");
    const contactApi = readSource("app/api/contact/route.ts");
    const contactValidation = readSource("lib/validation/contact.ts");

    expect(contactPage).toContain('import { ContactForm }');
    expect(contactPage).toContain("<ContactForm />");
    for (const field of ["name", "email", "phone", "enquiry_type", "message"]) expect(form).toContain(`name="${field}"`);
    expect(form).toContain('fetch("/api/contact"');
    expect(contactApi).toContain("checkIpRateLimit");
    expect(contactApi).toContain("ContactFormSchema");
    expect(contactValidation).toContain("ENQUIRY_TYPES");
    expect(contactPage).not.toMatch(/mailto:|tel:|support@|\b\d{3}[- )]/i);
  });

  it("keeps R7 media local, provisional, documented, and accessible", () => {
    expect(allSupportingPageMedia).toHaveLength(6);
    for (const media of allSupportingPageMedia) {
      expect(media.src).toMatch(/^\/images\/kt-couriers\/provisional\//);
      expect(media.src).not.toMatch(/^https?:\/\//);
      expect(media.width).toBeGreaterThan(0);
      expect(media.height).toBeGreaterThan(0);
      expect(media.provisional).toBe(true);
      expect(media.status).toMatch(/^PROVISIONAL_R[24]$/);
      expect(media.sourceLedgerReference).toMatch(/^#/);
      expect(media.visibleBrandReview.trim()).not.toBe("");
      expect(existsSync(path.join(publicRoot, media.src))).toBe(true);
      if (!media.decorative) expect(media.alt.trim()).not.toBe("");
    }
  });

  it("keeps pages server-first and avoids prohibited visual or interaction systems", () => {
    for (const source of pageComponentSources) {
      expect(source).not.toContain('"use client"');
      expect(source).not.toMatch(/gsap|ScrollTrigger|page.*pin|pin\s*:/i);
      expect(source).not.toMatch(/anonymous tracking|marketplace activation/i);
    }
    expect(supportCss).toContain("prefers-reduced-motion");
    expect(supportCss).toContain("forced-colors");
    expect(supportCss).not.toMatch(/gradient|purple|glassmorphism/i);
    expect(routeSources.join("\n")).not.toMatch(/https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)/i);
  });
});
