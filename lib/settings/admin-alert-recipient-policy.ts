export const ADMIN_ALERT_EVENT_TYPES = [
  "PARCEL_ORDER_CREATED",
  "PARCEL_ORDER_PAID",
  "PARCEL_PAYMENT_FAILED",
  "PARCEL_ORDER_ACCEPTED",
  "PARCEL_ORDER_UNPAID_EXPIRED",
  "PARCEL_ORDER_CANCELLED",
  "PARCEL_DRIVER_ASSIGNED",
  "PARCEL_PICKUP_STARTED",
  "PARCEL_PICKED_UP",
  "PARCEL_IN_TRANSIT",
  "PARCEL_DELIVERY_ATTEMPTED",
  "PARCEL_DELIVERED",
  "PARCEL_DELIVERY_FAILED",
  "MARKETPLACE_ORDER_PAID",
  "STORE_READINESS_BLOCKER",
  "PAYMENT_RECONCILIATION_ALERT",
  "NEW_CUSTOMER_REGISTERED",
  "NEW_STORE_APPLICATION",
  "NEW_DRIVER_APPLICATION",
  "LOW_RATED_REVIEW",
  "DRIVER_CASH_DEPOSIT_SUBMITTED",
  "COD_REMITTANCE_RECONCILED",
  "COD_RECONCILIATION_DISCREPANCY",
  "WITHDRAWAL_REQUESTED",
] as const;

export type AdminAlertEventType = (typeof ADMIN_ALERT_EVENT_TYPES)[number];

export const ADMIN_ALERT_ROLE_SCOPES = ["ALL", "ADMIN", "SUPER_ADMIN"] as const;
export type AdminAlertRoleScope = (typeof ADMIN_ALERT_ROLE_SCOPES)[number];

export type AdminAlertRecipientConfig = Readonly<{
  email: string;
  label: string;
  active: boolean;
  roleScope?: AdminAlertRoleScope;
  events: readonly AdminAlertEventType[];
}>;

const PLACEHOLDER_EMAIL_PATTERNS = [
  /\[add\s+business\s+email\]/i,
  /\[add\s+owner\s+email\]/i,
  /\badd\s+business\s+email\b/i,
  /\badd\s+owner\s+email\b/i,
  /[\[\]<>]/,
  /@example\.(?:com|org|net|invalid)$/i,
  /\.invalid$/i,
];

const STRICT_EMAIL_REGEX =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isValidConfiguredNotificationEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized.length > 254) return false;
  if (PLACEHOLDER_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return false;
  }
  return STRICT_EMAIL_REGEX.test(normalized);
}

export function parseAdminAlertRecipients(
  raw: unknown,
): AdminAlertRecipientConfig[] | null {
  if (!Array.isArray(raw) || raw.length > 50) return null;
  const seenEmails = new Set<string>();
  const recipients: AdminAlertRecipientConfig[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const record = item as Record<string, unknown>;
    if (typeof record.email !== "string") return null;
    const email = record.email.trim().toLowerCase();
    if (!isValidConfiguredNotificationEmail(email) || seenEmails.has(email)) {
      return null;
    }
    if (typeof record.label !== "string") return null;
    const label = record.label.trim();
    if (
      label.length < 1 ||
      label.length > 120 ||
      /[<>\u0000-\u001f]/.test(label)
    ) {
      return null;
    }
    if (typeof record.active !== "boolean") return null;
    if (
      !Array.isArray(record.events) ||
      record.events.length === 0 ||
      record.events.length > ADMIN_ALERT_EVENT_TYPES.length
    ) {
      return null;
    }
    const events: AdminAlertEventType[] = [];
    for (const ev of record.events) {
      if (
        typeof ev !== "string" ||
        !ADMIN_ALERT_EVENT_TYPES.includes(ev as AdminAlertEventType)
      ) {
        return null;
      }
      if (!events.includes(ev as AdminAlertEventType)) {
        events.push(ev as AdminAlertEventType);
      }
    }
    let roleScope: AdminAlertRoleScope | undefined;
    if (record.roleScope !== undefined) {
      if (
        typeof record.roleScope !== "string" ||
        !ADMIN_ALERT_ROLE_SCOPES.includes(record.roleScope as AdminAlertRoleScope)
      ) {
        return null;
      }
      roleScope = record.roleScope as AdminAlertRoleScope;
    }
    seenEmails.add(email);
    recipients.push(
      Object.freeze({
        email,
        label,
        active: record.active,
        ...(roleScope ? { roleScope } : {}),
        events: Object.freeze(events),
      }),
    );
  }

  return recipients;
}

export function activeRecipientsForAdminAlertEvent(
  recipients: readonly AdminAlertRecipientConfig[],
  eventType: AdminAlertEventType,
  options?: { roleScope?: "ADMIN" | "SUPER_ADMIN" },
): AdminAlertRecipientConfig[] {
  return recipients.filter(
    (recipient) =>
      recipient.active &&
      isValidConfiguredNotificationEmail(recipient.email) &&
      recipient.events.includes(eventType) &&
      (!options?.roleScope ||
        !recipient.roleScope ||
        recipient.roleScope === "ALL" ||
        recipient.roleScope === options.roleScope),
  );
}

export const ADMIN_ALERT_EVENT_ADMIN_LINKS: Readonly<Record<AdminAlertEventType, string>> = {
  PARCEL_ORDER_CREATED: "/admin/orders",
  PARCEL_ORDER_PAID: "/admin/orders",
  PARCEL_PAYMENT_FAILED: "/admin/payments",
  PARCEL_ORDER_ACCEPTED: "/admin/orders",
  PARCEL_ORDER_UNPAID_EXPIRED: "/admin/orders",
  PARCEL_ORDER_CANCELLED: "/admin/orders",
  PARCEL_DRIVER_ASSIGNED: "/admin/dispatch",
  PARCEL_PICKUP_STARTED: "/admin/orders",
  PARCEL_PICKED_UP: "/admin/orders",
  PARCEL_IN_TRANSIT: "/admin/orders",
  PARCEL_DELIVERY_ATTEMPTED: "/admin/orders",
  PARCEL_DELIVERED: "/admin/orders",
  PARCEL_DELIVERY_FAILED: "/admin/orders",
  MARKETPLACE_ORDER_PAID: "/admin/orders",
  STORE_READINESS_BLOCKER: "/admin/stores",
  PAYMENT_RECONCILIATION_ALERT: "/admin/payment-reconciliation",
  NEW_CUSTOMER_REGISTERED: "/admin/users",
  NEW_STORE_APPLICATION: "/admin/stores",
  NEW_DRIVER_APPLICATION: "/admin/drivers",
  LOW_RATED_REVIEW: "/admin/driver-reviews",
  DRIVER_CASH_DEPOSIT_SUBMITTED: "/admin/cash-deposits",
  COD_REMITTANCE_RECONCILED: "/admin/cash-deposits",
  COD_RECONCILIATION_DISCREPANCY: "/admin/cash-deposits",
  WITHDRAWAL_REQUESTED: "/admin/withdrawals",
};

export const ADMIN_ALERT_EVENT_LABELS: Readonly<Record<AdminAlertEventType, string>> = {
  PARCEL_ORDER_CREATED: "Parcel booking created",
  PARCEL_ORDER_PAID: "Parcel order paid",
  PARCEL_PAYMENT_FAILED: "Parcel payment failed",
  PARCEL_ORDER_ACCEPTED: "Parcel order accepted",
  PARCEL_ORDER_UNPAID_EXPIRED: "Unpaid parcel expired (24h)",
  PARCEL_ORDER_CANCELLED: "Parcel order cancelled",
  PARCEL_DRIVER_ASSIGNED: "Driver assigned to parcel",
  PARCEL_PICKUP_STARTED: "Driver started parcel pickup",
  PARCEL_PICKED_UP: "Parcel picked up",
  PARCEL_IN_TRANSIT: "Parcel in transit",
  PARCEL_DELIVERY_ATTEMPTED: "Parcel delivery attempted",
  PARCEL_DELIVERED: "Parcel delivered",
  PARCEL_DELIVERY_FAILED: "Parcel delivery failed",
  MARKETPLACE_ORDER_PAID: "Store marketplace order paid",
  STORE_READINESS_BLOCKER: "Store readiness blocker",
  PAYMENT_RECONCILIATION_ALERT: "Payment reconciliation alert",
  NEW_CUSTOMER_REGISTERED: "New customer account",
  NEW_STORE_APPLICATION: "New store application",
  NEW_DRIVER_APPLICATION: "New driver application",
  LOW_RATED_REVIEW: "Low-rated delivery or driver review",
  DRIVER_CASH_DEPOSIT_SUBMITTED: "Driver cash deposit submitted",
  COD_REMITTANCE_RECONCILED: "COD bank remittance reconciled",
  COD_RECONCILIATION_DISCREPANCY: "COD cash discrepancy / exception",
  WITHDRAWAL_REQUESTED: "Withdrawal requested",
};

export function getAdminAlertAdminPath(eventType: AdminAlertEventType): string {
  return ADMIN_ALERT_EVENT_ADMIN_LINKS[eventType];
}

export function getAdminAlertEventLabel(eventType: AdminAlertEventType): string {
  return ADMIN_ALERT_EVENT_LABELS[eventType];
}
