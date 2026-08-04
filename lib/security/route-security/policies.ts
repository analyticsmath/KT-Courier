import type { RouteSecurityPolicy } from "./types";

/**
 * Approved security authentication and authorization helper registry.
 * Used by static analysis tools to verify code implementation evidence for declared route security policies.
 */
export const APPROVED_SECURITY_HELPERS = [
  "getCurrentUser",
  "requireAuth",
  "requireRole",
  "requireAdminPagePermission",
  "hasPermission",
  "getStoreForUser",
  "resolveStoreContext",
  "enforceSameOriginRequest",
  "checkIpRateLimit",
  "checkAuthRateLimit",
  "verifyDeveloperApiRequest",
  "verifyPayfastItn",
  "verifyWebhookSignature",
] as const;

/**
 * Source-controlled Explicit Route Security Policies Dataset.
 * Maps specific route patterns and methods to explicit security classifications.
 */
export const ROUTE_SECURITY_POLICIES: RouteSecurityPolicy[] = [
  // ── Public Authentication & Onboarding ──────────────────────────────────
  {
    publicPathPattern: "/api/auth/signup",
    method: "POST",
    securityClass: "PUBLIC_INTENTIONAL",
    authenticationStrategy: "NONE",
    rateLimitPolicy: "SIGNUP",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/auth/signup/route.ts",
  },
  {
    publicPathPattern: "/api/auth/login",
    method: "POST",
    securityClass: "PUBLIC_INTENTIONAL",
    authenticationStrategy: "NONE",
    rateLimitPolicy: "LOGIN",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/auth/login/route.ts",
  },

  // ── Webhooks & External Callbacks ────────────────────────────────────────
  {
    publicPathPattern: "/api/payments/payfast/itn",
    method: "POST",
    securityClass: "WEBHOOK_VERIFIED",
    authenticationStrategy: "SIGNATURE_VERIFIED",
    rateLimitPolicy: "PAYMENT_CHECKOUT",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/payments/payfast/itn/route.ts",
  },
  {
    publicPathPattern: "/api/webhooks/resend",
    method: "POST",
    securityClass: "WEBHOOK_VERIFIED",
    authenticationStrategy: "SIGNATURE_VERIFIED",
    rateLimitPolicy: "DEFAULT",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/webhooks/resend/route.ts",
  },

  // ── Developer API ────────────────────────────────────────────────────────
  {
    publicPathPattern: "/api/v1/*",
    method: "GET",
    securityClass: "API_CLIENT_AUTHENTICATED",
    authenticationStrategy: "BEARER_HMAC",
    rateLimitPolicy: "DEVELOPER_API",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/v1/[[...path]]/route.ts",
  },
  {
    publicPathPattern: "/api/v1/*",
    method: "POST",
    securityClass: "API_CLIENT_AUTHENTICATED",
    authenticationStrategy: "BEARER_HMAC",
    rateLimitPolicy: "DEVELOPER_API",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/v1/[[...path]]/route.ts",
  },

  // ── Store Operations (Ownership Gated) ──────────────────────────────────
  {
    publicPathPattern: "/api/store/ads/campaigns",
    method: "GET",
    securityClass: "OWNERSHIP_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["STORE"],
    ownershipStrategy: "STORE_OWNER",
    rateLimitPolicy: "CATALOG_MUTATION",
    auditRequired: true,
    requestIntegrityRequired: false,
    sourceFile: "app/api/store/ads/campaigns/route.ts",
  },
  {
    publicPathPattern: "/api/store/ads/campaigns",
    method: "POST",
    securityClass: "OWNERSHIP_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["STORE"],
    ownershipStrategy: "STORE_OWNER",
    rateLimitPolicy: "CATALOG_MUTATION",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/store/ads/campaigns/route.ts",
  },
  {
    publicPathPattern: "/api/store/ads/campaigns/:campaignRef/funding",
    method: "POST",
    securityClass: "OWNERSHIP_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["STORE"],
    ownershipStrategy: "STORE_OWNER",
    workflowRequirement: "CAMPAIGN_FUNDING",
    rateLimitPolicy: "CATALOG_MUTATION",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/store/ads/campaigns/[campaignRef]/funding/route.ts",
  },
  {
    publicPathPattern: "/api/store/promotions",
    method: "GET",
    securityClass: "OWNERSHIP_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["STORE"],
    ownershipStrategy: "STORE_OWNER",
    rateLimitPolicy: "CATALOG_MUTATION",
    auditRequired: true,
    requestIntegrityRequired: false,
    sourceFile: "app/api/store/promotions/route.ts",
  },
  {
    publicPathPattern: "/api/store/promotions",
    method: "POST",
    securityClass: "OWNERSHIP_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["STORE"],
    ownershipStrategy: "STORE_OWNER",
    rateLimitPolicy: "CATALOG_MUTATION",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/store/promotions/route.ts",
  },

  // ── Administrative Operations ────────────────────────────────────────────
  {
    publicPathPattern: "/api/admin/*",
    method: "GET",
    securityClass: "PERMISSION_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["ADMIN", "SUPER_ADMIN"],
    rateLimitPolicy: "DEFAULT",
    auditRequired: true,
    requestIntegrityRequired: false,
    sourceFile: "app/api/admin/route.ts",
  },
  {
    publicPathPattern: "/api/admin/*",
    method: "POST",
    securityClass: "PERMISSION_GATED",
    authenticationStrategy: "SESSION",
    requiredRoles: ["ADMIN", "SUPER_ADMIN"],
    rateLimitPolicy: "DEFAULT",
    auditRequired: true,
    requestIntegrityRequired: true,
    sourceFile: "app/api/admin/route.ts",
  },
];
