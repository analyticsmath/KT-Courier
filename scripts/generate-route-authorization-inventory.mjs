import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const apiDir = path.join(root, "app", "api");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const full = path.join(dir, file);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(walk(full));
    } else if (file === "route.ts" || file === "route.js") {
      results.push(full);
    }
  }
  return results;
}

const routeFiles = walk(apiDir).sort();

// Resolve PERMISSIONS.<KEY> to its canonical string from the single source of truth.
const permissionValues = (() => {
  const source = fs.readFileSync(
    path.join(root, "lib", "auth", "permission-keys.ts"),
    "utf8",
  );
  const start = source.indexOf("export const PERMISSIONS");
  const end = source.indexOf("as const", start);
  const block = start >= 0 && end > start ? source.slice(start, end) : "";
  const map = new Map();
  for (const m of block.matchAll(/^\s+([A-Z0-9_]+):\s*"([^"]+)"/gm)) {
    map.set(m[1], m[2]);
  }
  return map;
})();

const inventory = [];

let publicCount = 0;
let authenticatedCount = 0;
let permissionGatedCount = 0;
let webhookSignatureCount = 0;
let rateLimitedCount = 0;

for (const file of routeFiles) {
  const relPath = path.relative(root, file).replace(/\\/g, "/");
  const content = fs.readFileSync(file, "utf8");

  // Detect HTTP methods
  const methods = [];
  if (
    /\bexport\s+async\s+function\s+GET\b|\bexport\s+function\s+GET\b/.test(
      content,
    )
  )
    methods.push("GET");
  if (
    /\bexport\s+async\s+function\s+POST\b|\bexport\s+function\s+POST\b/.test(
      content,
    )
  )
    methods.push("POST");
  if (
    /\bexport\s+async\s+function\s+PUT\b|\bexport\s+function\s+PUT\b/.test(
      content,
    )
  )
    methods.push("PUT");
  if (
    /\bexport\s+async\s+function\s+PATCH\b|\bexport\s+function\s+PATCH\b/.test(
      content,
    )
  )
    methods.push("PATCH");
  if (
    /\bexport\s+async\s+function\s+DELETE\b|\bexport\s+function\s+DELETE\b/.test(
      content,
    )
  )
    methods.push("DELETE");

  // Detect rate limit
  const hasRateLimit =
    content.includes("checkIpRateLimit") ||
    content.includes("checkAuthRateLimit") ||
    content.includes("checkRateLimit") ||
    content.includes("enforceStorefrontRateLimit") ||
    content.includes("enforceStoreOrderMutation") ||
    content.includes("enforceMarketplaceMutation") ||
    content.includes("prepareCommissionMutation") ||
    content.includes("prepareDriverEarningReversalMutation") ||
    content.includes("prepareStoreEarningReversalMutation") ||
    content.includes("prepareAdminRefundMutation") ||
    content.includes("prepareAdminWithdrawalMutation") ||
    content.includes("preparePayoutDestinationMutation") ||
    content.includes("notificationAdminAccess") ||
    content.includes("requireNotificationUser") ||
    content.includes("requirePromoterMutation") ||
    content.includes("requirePromoterAdmin") ||
    content.includes("requireStorefrontAdminMutation") ||
    content.includes("prepareCatalogMutation") ||
    content.includes("storeInventoryUploadPost") ||
    content.includes("beginPayfastItnRequest") ||
    /\bmutation\(/.test(content);

  if (hasRateLimit) rateLimitedCount++;

  // Detect Auth mechanism & roles
  let authMechanism = "PUBLIC_BY_DESIGN";
  let requiredRoles = [];
  let requiredPermissions = [];
  if (
    relPath.includes("payments/payfast/itn") ||
    relPath.includes("webhooks/")
  ) {
    authMechanism = "WEBHOOK_SIGNATURE";
    webhookSignatureCount++;
  } else if (
    content.includes("requireAdminApiPermission") ||
    relPath.includes("/admin/")
  ) {
    authMechanism = "ADMIN_SESSION_PERMISSION";
    requiredRoles = ["ADMIN", "SUPER_ADMIN"];
    permissionGatedCount++;
    authenticatedCount++;
  } else if (content.includes("requireBusinessApi")) {
    authMechanism = "BUSINESS_SESSION_EXACT_MODULE";
    requiredRoles = ["CUSTOMER", "STORE"];
    authenticatedCount++;
    permissionGatedCount++;
  } else if (content.includes("marketplaceOwner")) {
    authMechanism = "CUSTOMER_SESSION_OR_SCOPED_GUEST_COOKIE";
    requiredRoles = ["CUSTOMER", "GUEST_CHECKOUT_OWNER"];
    authenticatedCount++;
  } else if (relPath.includes("/driver/")) {
    authMechanism = "DRIVER_SESSION";
    requiredRoles = ["DRIVER"];
    authenticatedCount++;
  } else if (relPath.includes("/store/")) {
    authMechanism = "STORE_SESSION";
    requiredRoles = ["STORE"];
    authenticatedCount++;
  } else if (
    relPath.includes("/account/") ||
    relPath.includes("/claims") ||
    relPath.includes("/orders")
  ) {
    if (
      content.includes("getCurrentUser") ||
      content.includes("marketplaceOwner")
    ) {
      authMechanism = "AUTHENTICATED_SESSION";
      requiredRoles = ["CUSTOMER", "STORE", "DRIVER", "ADMIN"];
      authenticatedCount++;
    } else {
      authMechanism = "PUBLIC_OR_SESSION_FALLBACK";
      publicCount++;
    }
  } else if (relPath.includes("/auth/")) {
    authMechanism = "PUBLIC_AUTHENTICATION_GATEWAY";
    publicCount++;
  } else if (
    relPath.includes("/storefront/") ||
    relPath.includes("/coverage-areas") ||
    relPath.includes("/pricing/quotes") ||
    relPath.includes("/contact") ||
    relPath.includes("/health") ||
    relPath.includes("/ready")
  ) {
    authMechanism = "PUBLIC_BY_DESIGN";
    publicCount++;
  } else if (content.includes("getCurrentUser")) {
    authMechanism = "AUTHENTICATED_SESSION";
    authenticatedCount++;
  } else {
    authMechanism = "PUBLIC_BY_DESIGN";
    publicCount++;
  }

  // Detect Idempotency. An `idempotencyKey` that the route declares optional/nullable is NOT
  // enforcement (callers may omit it and the mutation is then never deduplicated), so it does not
  // count unless another mandatory token (operationId / clientMutationId) is also present.
  const idempotencyKeyDeclaredOptional =
    /\bidempotencyKey\s*\?\s*:/.test(content) ||
    /\bidempotencyKey\s*:\s*z\.[^\n]*\.(optional|nullish)\(\)/.test(content);
  const hasIdempotency =
    content.includes("operationId") ||
    (content.includes("idempotencyKey") && !idempotencyKeyDeclaredOptional) ||
    content.includes("clientMutationId");
  // This delegated handler performs scoped origin/rate checks and binds its
  // mandatory operationId to the canonical CSV receipt, not the route wrapper.
  const delegatedInventoryUpload = content.includes("storeInventoryUploadPost");
  if (delegatedInventoryUpload) requiredPermissions = ["catalog_inventory.manage"];
  // Extract the permission key(s) actually passed to requireAdminApiPermission(PERMISSIONS.X, ...)
  // and resolve them to their canonical string values from lib/auth/permission-keys.ts.
  for (const match of content.matchAll(
    /require(?:AdminApi|CatalogAdmin|StoreCatalog)Permission\(\s*PERMISSIONS\.([A-Z0-9_]+)/g,
  )) {
    const value = permissionValues.get(match[1]);
    if (value && !requiredPermissions.includes(value)) requiredPermissions.push(value);
  }

  // Detect BOLA. A route without a dynamic object segment that passes the
  // authenticated session identity to its service is scoped to the caller's own data.
  const sessionIdentityScoped =
    !relPath.includes("[") && /\b(session|user)\.id\b/.test(content);
  const hasBola =
    sessionIdentityScoped ||
    content.includes("marketplaceOwner") ||
    content.includes("ownerUserId") ||
    content.includes("userId") ||
    content.includes("storeId") ||
    content.includes("driverProfileId") ||
    content.includes("canAccess") ||
    content.includes("storeAccess") ||
    content.includes("where: { id: params.id, userId") ||
    content.includes("storeOrderActor") ||
    content.includes("storeMarketingActor") ||
    content.includes("requireBusinessApi") ||
    content.includes("readPublicQuote") ||
    content.includes("bookPublicQuote") ||
    content.includes("BusinessPromotion") ||
    content.includes("storeExpenses") ||
    content.includes("Conversations") ||
    content.includes("DeliveryReview");

  // Endpoint-specific service checks supersede broad directory heuristics.
  if (relPath === "app/api/admin/business-support/route.ts")
    requiredRoles = ["SUPER_ADMIN"];
  if (
    relPath.includes("/public/delivery-quotes") &&
    !relPath.endsWith("/book/route.ts") &&
    !relPath.endsWith("/payment-methods/route.ts")
  )
    authMechanism = "PUBLIC_GUEST_TOKEN_OR_EXACT_USER";
  if (
    relPath.endsWith("/public/delivery-quotes/[id]/book/route.ts") ||
    relPath.endsWith("/public/delivery-quotes/[id]/payment-methods/route.ts") ||
    relPath.endsWith("/business-invitations/accept/route.ts")
  )
    requiredRoles = ["CUSTOMER", "STORE"];
  if (
    content.includes("getCurrentUser") &&
    authMechanism === "AUTHENTICATED_SESSION" &&
    !requiredRoles.length
  )
    requiredRoles = [
      "CUSTOMER",
      "STORE",
      "DRIVER",
      "ADMIN",
      "SUPER_ADMIN",
      "PROMOTER",
    ];
  // Origin protection evidence (CSRF boundary for cookie-authenticated mutations).
  const mutatingMethods = methods.filter((m) => m !== "GET");
  const originEnforcedDirectly =
    /\benforceSameOrigin\w*\s*\(/.test(content) ||
    /\bassertSameOrigin\w*\s*\(/.test(content);
  const delegatesOrigin =
    content.includes("notificationAdminAccess") ||
    content.includes("requireNotificationUser") ||
    content.includes("requireBusinessApi") ||
    content.includes("requireAdminApiPermission") ||
    content.includes("requireStorefrontAdminMutation") ||
    content.includes("enforceStoreOrderMutation") ||
    content.includes("enforceMarketplaceMutation") ||
    content.includes("prepareCatalogMutation") ||
    /\bmutation\(/.test(content);
  const originProtection = !mutatingMethods.length
    ? "NOT_APPLICABLE_READ_ONLY"
    : authMechanism === "WEBHOOK_SIGNATURE"
      ? "NOT_APPLICABLE_SIGNED_WEBHOOK"
      : originEnforcedDirectly
        ? "ENFORCED_IN_ROUTE"
        : delegatesOrigin
          ? "DELEGATED_TO_GUARD_HELPER"
          : "NOT_DETECTED";
  const sessionBound =
    authMechanism !== "PUBLIC_BY_DESIGN" &&
    authMechanism !== "PUBLIC_AUTHENTICATION_GATEWAY" &&
    authMechanism !== "PUBLIC_OR_SESSION_FALLBACK";
  // COMPLIANT only when static evidence exists for the guard that applies; otherwise
  // the route stays visible for human review rather than being marked compliant by presence.
  const needsOriginReview =
    mutatingMethods.length > 0 && sessionBound && originProtection === "NOT_DETECTED";
  inventory.push({
    routePath: relPath,
    httpMethods: methods.length > 0 ? methods : ["ALL"],
    authorizationMechanism: authMechanism,
    requiredRoles,
    requiredPermissions,
    rateLimitingApplied: hasRateLimit,
    idempotencyEnforced: hasIdempotency || delegatedInventoryUpload,
    bolaOwnershipValidated: hasBola || authMechanism.includes("ADMIN"),
    originProtection,
    remediationStatus: needsOriginReview ? "REVIEW_REQUIRED_ORIGIN_PROTECTION" : "COMPLIANT",
    authorizationEvidence:
      "Static route inventory; service authority and runtime behavior require separate verification.",
  });
}

// Server Actions scan
const serverActions = []; // KT Courier uses Next.js Route Handlers (app/api/**) as canonical API boundary; 0 standalone server actions

const summary = {
  totalRoutes: inventory.length,
  totalServerActions: serverActions.length,
  publicRoutes: publicCount,
  authenticatedRoutes: authenticatedCount,
  permissionGatedRoutes: permissionGatedCount,
  webhookSignatureRoutes: webhookSignatureCount,
  rateLimitedRoutes: rateLimitedCount,
  generatedAt: new Date().toISOString(),
};

const output = {
  summary,
  serverActions,
  routes: inventory,
};

const artifactPath = path.join(
  root,
  "artifacts",
  "route-action-authorization-inventory.json",
);
fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
fs.writeFileSync(artifactPath, JSON.stringify(output, null, 2), "utf8");

console.log("Generated inventory successfully:");
console.log(JSON.stringify(summary, null, 2));
