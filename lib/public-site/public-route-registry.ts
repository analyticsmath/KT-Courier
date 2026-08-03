import { legalDocumentRegistry } from "@/lib/public-legal/legal-document-registry";
import { publicServicePages } from "@/lib/public-services/service-page-registry";

export type PublicRouteStatus =
  | "READY"
  | "READY_PROVISIONAL_MEDIA"
  | "LOCKED_INFORMATIONAL"
  | "NOINDEX_FUNCTIONAL"
  | "LEGAL_DRAFT"
  | "LEGAL_REVIEW_REQUIRED"
  | "UNAVAILABLE"
  | "PROTECTED";

export type PublicRouteFamily =
  | "MARKETING"
  | "SERVICE"
  | "SUPPORT"
  | "AUTH"
  | "MARKETPLACE"
  | "PARTICIPATION"
  | "DEVELOPER"
  | "LEGAL";

export type PublicRouteDefinition = {
  id: string;
  route: `/${string}`;
  title: string;
  family: PublicRouteFamily;
  status: PublicRouteStatus;
  indexable: boolean;
  sitemap: boolean;
  canonical?: `/${string}`;
  notes?: readonly string[];
};

const marketingRoutes = [
  { id: "home", route: "/", title: "Courier services", family: "MARKETING", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "services", route: "/services", title: "Courier services", family: "SERVICE", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "about", route: "/about", title: "About", family: "MARKETING", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "coverage", route: "/coverage-areas", title: "Coverage areas", family: "SUPPORT", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "membership", route: "/membership", title: "Membership information", family: "MARKETING", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "careers", route: "/careers", title: "Careers", family: "PARTICIPATION", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "faq", route: "/faq", title: "Frequently asked questions", family: "SUPPORT", status: "READY", indexable: true, sitemap: true },
  { id: "contact", route: "/contact", title: "Contact", family: "SUPPORT", status: "READY_PROVISIONAL_MEDIA", indexable: true, sitemap: true },
  { id: "join", route: "/join", title: "Join the network", family: "PARTICIPATION", status: "READY", indexable: true, sitemap: true },
  { id: "developers", route: "/developers", title: "Developer API", family: "DEVELOPER", status: "READY", indexable: true, sitemap: true },
] as const satisfies readonly PublicRouteDefinition[];

const serviceRoutes = publicServicePages.map((service) => ({
  id: `service-${service.id}`,
  route: service.route,
  title: service.metadataTitle,
  family: "SERVICE" as const,
  status: "READY_PROVISIONAL_MEDIA" as const,
  indexable: service.indexable,
  sitemap: service.indexable,
  notes: ["Service suitability and availability are confirmed through the canonical request flow."],
}));

const legalRoutes = legalDocumentRegistry.flatMap((document) => {
  if (!document.route) return [];
  return [{
    id: `legal-${document.id}`,
    route: document.route,
    title: document.title,
    family: "LEGAL" as const,
    status: document.status === "DRAFT_UNAPPROVED" ? "LEGAL_DRAFT" as const : "LEGAL_REVIEW_REQUIRED" as const,
    indexable: document.indexable,
    sitemap: document.sitemap,
    notes: ["Publication state is controlled by the legal-document registry."],
  }];
});

const functionalAndProtectedRoutes = [
  { id: "marketplace", route: "/shop", title: "Marketplace", family: "MARKETPLACE", status: "READY", indexable: true, sitemap: true, notes: ["Pages resolve active public storefront projections; purchase readiness remains separate."] },
  { id: "marketplace-descendants", route: "/shop/*", title: "Marketplace descendants", family: "MARKETPLACE", status: "READY", indexable: true, sitemap: false, notes: ["Individual public records control their own canonical and publication state."] },
  { id: "cart", route: "/cart", title: "Marketplace cart", family: "MARKETPLACE", status: "NOINDEX_FUNCTIONAL", indexable: false, sitemap: false },
  { id: "checkout", route: "/checkout/*", title: "Marketplace checkout", family: "MARKETPLACE", status: "NOINDEX_FUNCTIONAL", indexable: false, sitemap: false },
  { id: "membership-checkout", route: "/membership/checkout", title: "Membership checkout", family: "MARKETING", status: "UNAVAILABLE", indexable: false, sitemap: false },
  { id: "order-confirmation", route: "/order-confirmation/*", title: "Order confirmation", family: "MARKETPLACE", status: "NOINDEX_FUNCTIONAL", indexable: false, sitemap: false },
  { id: "safety", route: "/safety", title: "Safety information", family: "SUPPORT", status: "UNAVAILABLE", indexable: false, sitemap: false },
  { id: "auth", route: "/login", title: "Sign in", family: "AUTH", status: "NOINDEX_FUNCTIONAL", indexable: false, sitemap: false, notes: ["All auth routes remain noindex."] },
  { id: "account", route: "/account/*", title: "Account", family: "AUTH", status: "PROTECTED", indexable: false, sitemap: false },
  { id: "applicant", route: "/applicant/*", title: "Applicant", family: "AUTH", status: "PROTECTED", indexable: false, sitemap: false },
] as const satisfies readonly PublicRouteDefinition[];

/** Presentation and validation authority only; it deliberately carries no permission or session data. */
export const publicRouteRegistry: readonly PublicRouteDefinition[] = [
  ...marketingRoutes,
  ...serviceRoutes,
  ...legalRoutes,
  ...functionalAndProtectedRoutes,
] as const;

export const sitemapPublicRoutes = publicRouteRegistry.filter((route) => route.indexable && route.sitemap);
