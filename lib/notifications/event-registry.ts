/**
 * Registry is intentionally limited to event families already emitted by the
 * repository. It is configuration input for category/route setup, not a second
 * delivery implementation.
 */
export const PHASE27_EVENT_REGISTRY = [
  { sourceAuthority: "LEGACY_ORDER", eventType: "ORDER_CONFIRMED", categoryKey: "ORDER_CONFIRMATION", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "LEGACY_ORDER", eventType: "ORDER_STATUS_CHANGED", categoryKey: "ORDER_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "LEGACY_ORDER", eventType: "DELIVERY_OTP_ISSUED", categoryKey: "DELIVERY_SECURITY", purpose: "SECURITY" },
  { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "EMAIL_VERIFICATION_OTP", categoryKey: "ACCOUNT_SECURITY", purpose: "SECURITY" },
  { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "PASSWORD_RESET", categoryKey: "ACCOUNT_SECURITY", purpose: "SECURITY" },
  { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "PASSWORD_CHANGED", categoryKey: "ACCOUNT_SECURITY", purpose: "SECURITY" },
  { sourceAuthority: "AUTHENTICATION_SECURITY", eventType: "DELIVERY_OTP", categoryKey: "DELIVERY_SECURITY", purpose: "SECURITY" },
  { sourceAuthority: "SUBSCRIPTIONS", eventType: "SUBSCRIPTION_ACTIVATED", categoryKey: "SUBSCRIPTION_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "SUBSCRIPTIONS", eventType: "SUBSCRIPTION_CANCELLATION_SCHEDULED", categoryKey: "SUBSCRIPTION_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "PROMOTERS", eventType: "PROMOTER_APPLICATION_SUBMITTED", categoryKey: "PROMOTER_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "PROMOTERS", eventType: "PROMOTER_RECONCILIATION_REQUIRED", categoryKey: "RECONCILIATION_REQUIRED", purpose: "OPERATIONAL" },
  { sourceAuthority: "STORE_ORDERS", eventType: "STORE_ORDER_ACCEPTED", categoryKey: "STORE_ORDER_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "STORE_ORDERS", eventType: "STORE_ORDER_REJECTED", categoryKey: "STORE_ORDER_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "STORE_ORDERS", eventType: "STORE_ORDER_READY_FOR_HANDOFF", categoryKey: "STORE_ORDER_STATUS", purpose: "TRANSACTIONAL" },
  { sourceAuthority: "STORE_ORDERS", eventType: "DELIVERY_ORDER_CREATED", categoryKey: "STORE_ORDER_STATUS", purpose: "TRANSACTIONAL" },
] as const;

export const KNOWN_NOTIFICATION_SOURCE_AUTHORITIES = ["LEGACY_ORDER", "AUTHENTICATION_SECURITY", "SUBSCRIPTIONS", "PROMOTERS", "STORE_ORDERS", "LEGACY_EMAIL_ADAPTER"] as const;
