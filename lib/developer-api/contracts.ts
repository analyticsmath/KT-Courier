/** Canonical public-developer API vocabulary. Never derive permissions from scopes. */
export const DEVELOPER_API_VERSION = "v1" as const;
export const DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED = false as const;
export const DEVELOPER_API_PRODUCTION_LOCK_REASON = "DEVELOPER_API_CONSOLIDATED_VALIDATION_NOT_APPROVED" as const;

export const DEVELOPER_SCOPES = Object.freeze({
  QUOTES_WRITE: "quotes:write",
  ORDERS_READ: "orders:read",
  ORDERS_WRITE: "orders:write",
  ORDERS_CANCEL: "orders:cancel",
  TRACKING_READ: "tracking:read",
  CATALOG_READ: "catalog:read",
  STORE_ORDERS_READ: "store_orders:read",
  STORE_ORDERS_MANAGE: "store_orders:manage",
  WEBHOOKS_READ: "webhooks:read",
  WEBHOOKS_WRITE: "webhooks:write",
  WEBHOOKS_DELIVERIES_READ: "webhooks:deliveries:read",
  WEBHOOKS_DELIVERIES_RETRY: "webhooks:deliveries:retry",
  PAYMENTS_READ: "payments:read",
  REFUNDS_READ: "refunds:read",
  SUBSCRIPTIONS_READ: "subscriptions:read",
} as const);

export type DeveloperScope = (typeof DEVELOPER_SCOPES)[keyof typeof DEVELOPER_SCOPES];
export const DEVELOPER_SCOPE_KEYS = Object.freeze(Object.values(DEVELOPER_SCOPES));

export const DEVELOPER_SCOPE_DESCRIPTIONS: Readonly<Record<DeveloperScope, string>> = Object.freeze({
  [DEVELOPER_SCOPES.QUOTES_WRITE]: "Create delivery price quotes for the approved owner.",
  [DEVELOPER_SCOPES.ORDERS_READ]: "Read courier orders belonging to the approved owner.",
  [DEVELOPER_SCOPES.ORDERS_WRITE]: "Create courier orders for the approved owner.",
  [DEVELOPER_SCOPES.ORDERS_CANCEL]: "Cancel eligible courier orders for the approved owner.",
  [DEVELOPER_SCOPES.TRACKING_READ]: "Read safe operational tracking for owned courier orders.",
  [DEVELOPER_SCOPES.CATALOG_READ]: "Read catalog entries belonging to the approved store.",
  [DEVELOPER_SCOPES.STORE_ORDERS_READ]: "Read marketplace store orders belonging to the approved store.",
  [DEVELOPER_SCOPES.STORE_ORDERS_MANAGE]: "Execute approved marketplace store-order actions for the approved store.",
  [DEVELOPER_SCOPES.WEBHOOKS_READ]: "Read webhook subscriptions and safe delivery metadata.",
  [DEVELOPER_SCOPES.WEBHOOKS_WRITE]: "Create and manage verified webhook subscriptions.",
  [DEVELOPER_SCOPES.WEBHOOKS_DELIVERIES_READ]: "Read safe webhook delivery history.",
  [DEVELOPER_SCOPES.WEBHOOKS_DELIVERIES_RETRY]: "Request a safe retry for an eligible webhook delivery.",
  [DEVELOPER_SCOPES.PAYMENTS_READ]: "Read safe payment outcome events for resources owned by the application owner.",
  [DEVELOPER_SCOPES.REFUNDS_READ]: "Read safe refund outcome events for resources owned by the application owner.",
  [DEVELOPER_SCOPES.SUBSCRIPTIONS_READ]: "Read safe subscription lifecycle events for resources owned by the application owner.",
});

export const APPLICATION_TRANSITIONS = Object.freeze({
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ACTIVE", "REVOKED"],
  ACTIVE: ["SUSPENDED", "REVOKED", "ARCHIVED"],
  SUSPENDED: ["ACTIVE", "REVOKED", "ARCHIVED"],
  REVOKED: [],
  ARCHIVED: [],
  REJECTED: ["ARCHIVED"],
} as const);

const publicWebhookEvent = <T extends DeveloperScope>(scope: T, sourceAuthority: string, sourceEventType: string, ownershipResolver: string, projectionAdapter: string) => Object.freeze({ scope, sourceAuthority, sourceEventType, ownershipResolver, projectionAdapter, schemaVersion: 1, retentionHours: 168, expiryHours: 168, enabled: true });
/** The enabled registry only contains durable, privacy-reviewed source adapters. */
export const WEBHOOK_EVENT_CATALOG = Object.freeze({
  "za.co.ktcouriers.order.created.v1": publicWebhookEvent(DEVELOPER_SCOPES.ORDERS_READ, "order-status-history", "PENDING", "order.customer-or-store-owner", "order-status-v1"),
  "za.co.ktcouriers.order.updated.v1": publicWebhookEvent(DEVELOPER_SCOPES.ORDERS_READ, "order-status-history", "ORDER_STATUS_CHANGED", "order.customer-or-store-owner", "order-status-v1"),
  "za.co.ktcouriers.order.cancelled.v1": publicWebhookEvent(DEVELOPER_SCOPES.ORDERS_READ, "order-status-history", "CANCELLED", "order.customer-or-store-owner", "order-status-v1"),
  "za.co.ktcouriers.store_order.action_required.v1": publicWebhookEvent(DEVELOPER_SCOPES.STORE_ORDERS_READ, "store-order-intent", "ACTION_REQUIRED", "store-order.store-owner", "store-order-intent-v1"),
  "za.co.ktcouriers.store_order.ready.v1": publicWebhookEvent(DEVELOPER_SCOPES.STORE_ORDERS_READ, "store-order-intent", "READY", "store-order.store-owner", "store-order-intent-v1"),
  "za.co.ktcouriers.driver.assigned.v1": publicWebhookEvent(DEVELOPER_SCOPES.TRACKING_READ, "order-assignment-event", "ASSIGNMENT_CREATED", "order.customer-or-store-owner", "assignment-v1"),
  "za.co.ktcouriers.delivery.picked_up.v1": publicWebhookEvent(DEVELOPER_SCOPES.TRACKING_READ, "order-operational-event", "PICKUP_COMPLETED", "order.customer-or-store-owner", "operational-v1"),
  "za.co.ktcouriers.delivery.completed.v1": publicWebhookEvent(DEVELOPER_SCOPES.TRACKING_READ, "order-operational-event", "DELIVERY_COMPLETED", "order.customer-or-store-owner", "operational-v1"),
  "za.co.ktcouriers.delivery.failed.v1": publicWebhookEvent(DEVELOPER_SCOPES.TRACKING_READ, "order-operational-event", "DELIVERY_FAILED", "order.customer-or-store-owner", "operational-v1"),
  "za.co.ktcouriers.payment.succeeded.v1": publicWebhookEvent(DEVELOPER_SCOPES.PAYMENTS_READ, "payment-status-history", "SUCCEEDED", "payment.customer-or-store-owner", "payment-outcome-v1"),
  "za.co.ktcouriers.payment.failed.v1": publicWebhookEvent(DEVELOPER_SCOPES.PAYMENTS_READ, "payment-status-history", "FAILED", "payment.customer-or-store-owner", "payment-outcome-v1"),
  "za.co.ktcouriers.refund.completed.v1": publicWebhookEvent(DEVELOPER_SCOPES.REFUNDS_READ, "refund-status-history", "SUCCEEDED", "refund.customer-or-payment-owner", "refund-outcome-v1"),
  "za.co.ktcouriers.subscription.activated.v1": publicWebhookEvent(DEVELOPER_SCOPES.SUBSCRIPTIONS_READ, "subscription-event-intent", "SUBSCRIPTION_ACTIVATED", "subscription.customer-or-store-owner", "subscription-lifecycle-v1"),
  "za.co.ktcouriers.subscription.renewal_failed.v1": publicWebhookEvent(DEVELOPER_SCOPES.SUBSCRIPTIONS_READ, "subscription-event-intent", "SUBSCRIPTION_PAYMENT_FAILED", "subscription.customer-or-store-owner", "subscription-lifecycle-v1"),
  "za.co.ktcouriers.subscription.cancelled.v1": publicWebhookEvent(DEVELOPER_SCOPES.SUBSCRIPTIONS_READ, "subscription-event-intent", "SUBSCRIPTION_CANCELLED", "subscription.customer-or-store-owner", "subscription-lifecycle-v1"),
} as const);

export type WebhookEventAdapterInventoryEntry = Readonly<{
  canonicalSourceAuthority: string;
  canonicalSourceEventType: string;
  publicWebhookEventType: string;
  publicEventVersion: 1;
  resourceOwnerResolver: string;
  requiredScope: DeveloperScope;
  publicProjectionAdapter: string;
  supported: boolean;
  unsupportedReason: string | null;
}>;

const supportedWebhookInventory = Object.entries(WEBHOOK_EVENT_CATALOG).map(([publicWebhookEventType, entry]) => Object.freeze({
  canonicalSourceAuthority: entry.sourceAuthority,
  canonicalSourceEventType: entry.sourceEventType,
  publicWebhookEventType,
  publicEventVersion: entry.schemaVersion,
  resourceOwnerResolver: entry.ownershipResolver,
  requiredScope: entry.scope,
  publicProjectionAdapter: entry.projectionAdapter,
  supported: true,
  unsupportedReason: null,
} satisfies WebhookEventAdapterInventoryEntry));

/**
 * Complete Phase 28 adapter inventory.  Unsupported rows are deliberately
 * retained as negative contract evidence: an event may not become public
 * until a durable canonical source and a privacy-reviewed mapper exist.
 */
export const WEBHOOK_EVENT_ADAPTER_INVENTORY = Object.freeze([
  ...supportedWebhookInventory,
  Object.freeze({ canonicalSourceAuthority: "refund-status-history", canonicalSourceEventType: "FAILED", publicWebhookEventType: "za.co.ktcouriers.refund.failed.v1", publicEventVersion: 1, resourceOwnerResolver: "refund.customer-or-payment-owner", requiredScope: DEVELOPER_SCOPES.REFUNDS_READ, publicProjectionAdapter: "none", supported: false, unsupportedReason: "RefundStatus has no FAILED terminal event; provider-attempt failure is not a refund authority." } satisfies WebhookEventAdapterInventoryEntry),
  Object.freeze({ canonicalSourceAuthority: "subscription-event-intent", canonicalSourceEventType: "SUBSCRIPTION_RENEWAL_SUCCEEDED", publicWebhookEventType: "za.co.ktcouriers.subscription.renewal_succeeded.v1", publicEventVersion: 1, resourceOwnerResolver: "subscription.customer-or-store-owner", requiredScope: DEVELOPER_SCOPES.SUBSCRIPTIONS_READ, publicProjectionAdapter: "none", supported: false, unsupportedReason: "Phase 22 has no durable SUBSCRIPTION_RENEWAL_SUCCEEDED event intent." } satisfies WebhookEventAdapterInventoryEntry),
]);

export class DeveloperApiError extends Error {
  constructor(public readonly code: string, public readonly status = 400, detail?: string) {
    super(detail ?? code.replaceAll("_", " ").toLowerCase());
    this.name = "DeveloperApiError";
  }
}

export function assertKnownScope(scope: string): asserts scope is DeveloperScope {
  if (!DEVELOPER_SCOPE_KEYS.includes(scope as DeveloperScope)) throw new DeveloperApiError("DEVELOPER_SCOPE_UNKNOWN", 400, "The requested scope is not available.");
}

export function assertExactScopes(scopes: readonly string[]): asserts scopes is readonly DeveloperScope[] {
  if (!Array.isArray(scopes) || scopes.length === 0 || new Set(scopes).size !== scopes.length) throw new DeveloperApiError("DEVELOPER_SCOPE_INVALID", 400, "Scopes must be a non-empty unique list.");
  for (const scope of scopes) assertKnownScope(scope);
}

export function allowsScope(scopes: readonly string[], required: DeveloperScope): boolean {
  return scopes.includes(required);
}

export function productionLocked(environment: "TEST" | "LIVE"): boolean {
  return environment === "LIVE" && !DEVELOPER_API_PRODUCTION_VALIDATION_APPROVED;
}
