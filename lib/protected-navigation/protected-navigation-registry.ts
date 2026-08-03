import { PERMISSIONS } from "@/lib/auth/permission-keys";
import type { UserRole } from "@/types/db";
import type {
  ProtectedApplicationContext,
  ProtectedNavigationGroup,
  ProtectedNavigationItem,
  ProtectedNavigationProjection,
} from "@/components/protected-v2/navigation/types";

export type { ProtectedApplicationContext, ProtectedNavigationGroup, ProtectedNavigationItem, ProtectedNavigationProjection };

const C = {
  CUSTOMER: ["CUSTOMER"],
  STORE: ["STORE"],
  DRIVER: ["DRIVER"],
  PROMOTER: ["PROMOTER"],
  DEVELOPER: ["DEVELOPER"],
  ADMIN: ["ADMIN", "SUPER_ADMIN"],
  SUPER_ADMIN: ["SUPER_ADMIN"],
} as const satisfies Record<string, readonly ProtectedApplicationContext[]>;

/**
 * A context is a presentation workspace, not a role. Applicant intentionally
 * has no entry here: it remains outside the formal protected-role shell until
 * its dedicated R19 authority is adopted.
 */
export const PROTECTED_CONTEXTS_BY_ROLE: Readonly<Record<UserRole, readonly ProtectedApplicationContext[]>> = {
  CUSTOMER: ["CUSTOMER", "DEVELOPER"],
  STORE: ["STORE", "DEVELOPER"],
  DRIVER: ["DRIVER"],
  PROMOTER: ["PROMOTER"],
  ADMIN: ["ADMIN"],
  SUPER_ADMIN: ["ADMIN", "SUPER_ADMIN"],
};

export const PROTECTED_NAVIGATION_REGISTRY: readonly ProtectedNavigationItem[] = [
  { id: "customer-overview", label: "Overview", href: "/account", icon: "home", group: "Workspace", exact: true, mobilePriority: 1, contexts: C.CUSTOMER },
  { id: "customer-request", label: "Request delivery", href: "/account/request-delivery", icon: "plus", group: "Workspace", mobilePriority: 2, contexts: C.CUSTOMER },
  { id: "customer-orders", label: "My deliveries", href: "/account/orders", icon: "package", group: "Workspace", mobilePriority: 3, contexts: C.CUSTOMER },
  { id: "customer-wallet", label: "Wallet", href: "/account/wallet", icon: "wallet", group: "Finance", mobilePriority: 4, contexts: C.CUSTOMER },
  { id: "customer-refunds", label: "Refunds", href: "/account/refunds", icon: "credit-card", group: "Finance", contexts: C.CUSTOMER },
  { id: "customer-addresses", label: "Saved addresses", href: "/account/addresses", icon: "map", group: "Account", contexts: C.CUSTOMER },
  { id: "customer-notifications", label: "Notifications", href: "/account/notifications", icon: "bell", group: "Account", mobilePriority: 5, contexts: C.CUSTOMER },
  { id: "customer-profile", label: "Account settings", href: "/account/profile", icon: "people", group: "Account", contexts: C.CUSTOMER },
  { id: "customer-support", label: "Support", href: "/account/support", icon: "support", group: "Account", contexts: C.CUSTOMER },

  { id: "store-overview", label: "Overview", href: "/store", icon: "home", group: "Workspace", exact: true, mobilePriority: 1, contexts: C.STORE },
  { id: "store-orders", label: "Orders", href: "/store/orders", icon: "clipboard", group: "Workspace", mobilePriority: 2, contexts: C.STORE },
  { id: "store-delivery", label: "New delivery", href: "/store/new-delivery", icon: "plus", group: "Workspace", mobilePriority: 3, contexts: C.STORE },
  { id: "store-catalog", label: "Product catalog", href: "/store/catalog", icon: "archive", group: "Commerce", contexts: C.STORE },
  { id: "store-earnings", label: "Earnings", href: "/store/earnings", icon: "wallet", group: "Finance", mobilePriority: 4, contexts: C.STORE },
  { id: "store-advertising", label: "Advertising", href: "/store/advertising", icon: "chart", group: "Growth", contexts: C.STORE },
  { id: "store-notifications", label: "Notifications", href: "/store/notifications", icon: "bell", group: "Account", mobilePriority: 5, contexts: C.STORE },
  { id: "store-profile", label: "Store settings", href: "/store/profile", icon: "store", group: "Account", contexts: C.STORE },
  { id: "store-support", label: "Support", href: "/store/support", icon: "support", group: "Account", contexts: C.STORE },

  { id: "driver-overview", label: "Overview", href: "/driver", icon: "home", group: "Workspace", exact: true, mobilePriority: 1, contexts: C.DRIVER },
  { id: "driver-assignments", label: "Assignments", href: "/driver/assignments", icon: "route", group: "Workspace", mobilePriority: 2, contexts: C.DRIVER },
  { id: "driver-delivery", label: "Active delivery", href: "/driver/delivery", icon: "package", group: "Workspace", mobilePriority: 3, contexts: C.DRIVER },
  { id: "driver-availability", label: "Availability", href: "/driver/availability", icon: "activity", group: "Workspace", mobilePriority: 4, contexts: C.DRIVER },
  { id: "driver-earnings", label: "Earnings", href: "/driver/earnings", icon: "wallet", group: "Finance", mobilePriority: 5, contexts: C.DRIVER },
  { id: "driver-notifications", label: "Notifications", href: "/driver/notifications", icon: "bell", group: "Account", contexts: C.DRIVER },
  { id: "driver-profile", label: "My profile", href: "/driver/profile", icon: "people", group: "Account", contexts: C.DRIVER },

  { id: "promoter-overview", label: "Overview", href: "/promoter", icon: "home", group: "Workspace", exact: true, mobilePriority: 1, contexts: C.PROMOTER },
  { id: "promoter-programs", label: "Programmes", href: "/promoter/programs", icon: "briefcase", group: "Workspace", requiredPermissions: [PERMISSIONS.PROMOTER_PROGRAMS_READ], contexts: C.PROMOTER },
  { id: "promoter-links", label: "Referral tools", href: "/promoter/links", icon: "route", group: "Workspace", requiredPermissions: [PERMISSIONS.PROMOTER_CODES_MANAGE_OWN], mobilePriority: 2, contexts: C.PROMOTER },
  { id: "promoter-referrals", label: "Referrals", href: "/promoter/referrals", icon: "people", group: "Workspace", requiredPermissions: [PERMISSIONS.PROMOTER_REFERRALS_READ_OWN], mobilePriority: 3, contexts: C.PROMOTER },
  { id: "promoter-earnings", label: "Earnings", href: "/promoter/earnings", icon: "wallet", group: "Finance", requiredPermissions: [PERMISSIONS.PROMOTER_EARNINGS_READ_OWN], mobilePriority: 4, contexts: C.PROMOTER },
  { id: "promoter-wallet", label: "Wallet", href: "/promoter/wallet", icon: "card", group: "Finance", requiredPermissions: [PERMISSIONS.PROMOTER_WALLET_READ_OWN], mobilePriority: 5, contexts: C.PROMOTER },
  { id: "promoter-withdrawals", label: "Withdrawals", href: "/promoter/withdrawals", icon: "credit-card", group: "Finance", requiredPermissions: [PERMISSIONS.PROMOTER_WITHDRAWALS_CREATE_OWN], contexts: C.PROMOTER },
  { id: "promoter-assets", label: "Assets", href: "/promoter/assets", icon: "folder", group: "Growth", requiredPermissions: [PERMISSIONS.PROMOTER_ASSETS_READ], contexts: C.PROMOTER },
  { id: "promoter-compliance", label: "Compliance", href: "/promoter/compliance", icon: "shield", group: "Account", contexts: C.PROMOTER },
  { id: "promoter-profile", label: "Profile", href: "/promoter/profile", icon: "people", group: "Account", requiredPermissions: [PERMISSIONS.PROMOTER_PROFILE_READ_OWN], contexts: C.PROMOTER },
  { id: "promoter-disputes", label: "Disputes", href: "/promoter/disputes", icon: "file", group: "Account", requiredPermissions: [PERMISSIONS.PROMOTER_DISPUTES_MANAGE_OWN], contexts: C.PROMOTER },
  { id: "promoter-notifications", label: "Notifications", href: "/promoter/notifications", icon: "bell", group: "Account", requiredPermissions: [PERMISSIONS.NOTIFICATION_READ_OWN], contexts: C.PROMOTER },
  { id: "promoter-support", label: "Support", href: "/promoter/support", icon: "support", group: "Account", contexts: C.PROMOTER },

  { id: "developer-docs", label: "Documentation", href: "/developers/documentation", icon: "book", group: "Integration", requiredPermissions: [PERMISSIONS.DEVELOPER_DOCUMENTATION_READ], contexts: C.DEVELOPER },
  { id: "developer-applications", label: "Applications", href: "/developers/applications", icon: "briefcase", group: "Integration", requiredPermissions: [PERMISSIONS.DEVELOPER_APPLICATION_READ_OWN], contexts: C.DEVELOPER },
  { id: "developer-credentials", label: "Credentials", href: "/developers/credentials", icon: "key", group: "Integration", requiredPermissions: [PERMISSIONS.DEVELOPER_CREDENTIAL_READ_OWN], contexts: C.DEVELOPER },
  { id: "developer-webhooks", label: "Webhooks", href: "/developers/webhooks", icon: "route", group: "Operations", requiredPermissions: [PERMISSIONS.DEVELOPER_WEBHOOK_READ_OWN], contexts: C.DEVELOPER },
  { id: "developer-usage", label: "Usage and quotas", href: "/developers/usage", icon: "chart", group: "Operations", requiredPermissions: [PERMISSIONS.DEVELOPER_API_USAGE_READ_OWN], contexts: C.DEVELOPER },

  { id: "admin-overview", label: "Overview", href: "/admin", icon: "home", group: "Command centre", exact: true, requiredPermissions: [PERMISSIONS.ADMIN_DASHBOARD_READ], contexts: C.ADMIN },
  { id: "admin-orders", label: "Orders", href: "/admin/orders", icon: "clipboard", group: "Operations", requiredPermissions: [PERMISSIONS.ORDERS_READ], contexts: C.ADMIN },
  { id: "admin-dispatch", label: "Dispatch", href: "/admin/dispatch", icon: "route", group: "Operations", requiredPermissions: [PERMISSIONS.DISPATCH_READ], contexts: C.ADMIN },
  { id: "admin-pickup-exceptions", label: "Pickup exceptions", href: "/admin/pickup-exceptions", icon: "activity", group: "Operations", requiredPermissions: [PERMISSIONS.DISPATCH_READ], contexts: C.ADMIN },
  { id: "admin-regions", label: "Regions", href: "/admin/regions", icon: "map", group: "Operations", requiredPermissions: [PERMISSIONS.REGIONS_READ], contexts: C.ADMIN },
  { id: "admin-pricing", label: "Pricing", href: "/admin/pricing", icon: "card", group: "Operations", requiredPermissions: [PERMISSIONS.PRICING_READ], contexts: C.ADMIN },
  { id: "admin-users", label: "Users", href: "/admin/users", icon: "people", group: "People and network", requiredPermissions: [PERMISSIONS.USERS_READ], contexts: C.ADMIN },
  { id: "admin-employees", label: "Employees", href: "/admin/employees", icon: "briefcase", group: "People and network", requiredPermissions: [PERMISSIONS.EMPLOYEES_READ], contexts: C.ADMIN },
  { id: "admin-stores", label: "Stores", href: "/admin/stores", icon: "store", group: "People and network", requiredPermissions: [PERMISSIONS.STORES_READ], contexts: C.ADMIN },
  { id: "admin-drivers", label: "Drivers", href: "/admin/drivers", icon: "people", group: "People and network", requiredPermissions: [PERMISSIONS.DRIVERS_READ], contexts: C.ADMIN },
  { id: "admin-catalog", label: "Catalog", href: "/admin/catalog", icon: "archive", group: "Commerce", requiredPermissions: [PERMISSIONS.CATALOG_MODERATION_READ], contexts: C.ADMIN },
  { id: "admin-finance", label: "Finance overview", href: "/admin/finance", icon: "chart", group: "Finance", requiredPermissions: [PERMISSIONS.FINANCE_DASHBOARD_READ], contexts: C.ADMIN },
  { id: "admin-ledger", label: "Ledger", href: "/admin/ledger", icon: "book", group: "Finance", requiredPermissions: [PERMISSIONS.LEDGER_READ], contexts: C.ADMIN },
  { id: "admin-payments", label: "Payments", href: "/admin/payments", icon: "credit-card", group: "Finance", requiredPermissions: [PERMISSIONS.PAYMENTS_READ], contexts: C.ADMIN },
  { id: "admin-withdrawals", label: "Withdrawals", href: "/admin/withdrawals", icon: "wallet", group: "Finance", requiredPermissions: [PERMISSIONS.WITHDRAWALS_READ], contexts: C.ADMIN },
  { id: "admin-refunds", label: "Refunds", href: "/admin/refunds", icon: "card", group: "Finance", requiredPermissions: [PERMISSIONS.REFUNDS_READ], contexts: C.ADMIN },
  { id: "admin-commissions", label: "Commissions", href: "/admin/commissions", icon: "file", group: "Finance", requiredPermissions: [PERMISSIONS.COMMISSIONS_READ], contexts: C.ADMIN },
  { id: "admin-advertising", label: "Advertising", href: "/admin/advertising", icon: "chart", group: "Growth programmes", requiredPermissions: [PERMISSIONS.ADVERTISING_READ], contexts: C.ADMIN },
  { id: "admin-promoters", label: "Promoters", href: "/admin/promoters", icon: "people", group: "Growth programmes", requiredPermissions: [PERMISSIONS.PROMOTERS_READ], contexts: C.ADMIN },
  { id: "admin-developers", label: "Developers", href: "/admin/developers", icon: "key", group: "Platform", requiredPermissions: [PERMISSIONS.DEVELOPER_APPLICATION_READ], contexts: C.ADMIN },
  { id: "admin-emails", label: "Emails", href: "/admin/emails", icon: "file", group: "Platform", requiredPermissions: [PERMISSIONS.EMAILS_READ], contexts: C.ADMIN },
  { id: "admin-notifications", label: "Notifications", href: "/admin/notifications", icon: "bell", group: "Platform", requiredPermissions: [PERMISSIONS.NOTIFICATION_TEMPLATE_READ], contexts: C.ADMIN },
  { id: "admin-permissions", label: "Permissions", href: "/admin/permissions", icon: "shield", group: "Governance", requiredPermissions: [PERMISSIONS.EMPLOYEES_PERMISSIONS_MANAGE], contexts: C.ADMIN },
  { id: "admin-settings", label: "Settings", href: "/admin/settings", icon: "cog", group: "Governance", requiredPermissions: [PERMISSIONS.SETTINGS_READ], contexts: C.ADMIN },
  { id: "admin-activity", label: "Activity", href: "/admin/activity", icon: "activity", group: "Governance", requiredPermissions: [PERMISSIONS.ACTIVITY_READ], contexts: C.ADMIN },
];

export function isProtectedContextAvailableToRole(
  role: UserRole,
  context: ProtectedApplicationContext,
): boolean {
  return PROTECTED_CONTEXTS_BY_ROLE[role].includes(context);
}

/** Pure filter used after server permission resolution; it never serializes the source permission list. */
export function projectProtectedNavigation(
  context: ProtectedApplicationContext,
  effectivePermissionKeys: ReadonlySet<string>,
): ProtectedNavigationProjection {
  const visibleItems = PROTECTED_NAVIGATION_REGISTRY.filter(
    (item) =>
      item.contexts.includes(context) &&
      (!item.requiredPermissions || item.requiredPermissions.every((key) => effectivePermissionKeys.has(key))),
  );

  const groupOrder = Array.from(new Set(visibleItems.map((item) => item.group)));
  const groups = groupOrder.map((label) => ({
    id: label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-"),
    label,
    items: visibleItems.filter((item) => item.group === label),
  }));

  return {
    groups,
    mobileNavigation: visibleItems
      .filter((item) => item.mobilePriority !== undefined)
      .sort((a, b) => (a.mobilePriority ?? Number.MAX_SAFE_INTEGER) - (b.mobilePriority ?? Number.MAX_SAFE_INTEGER)),
  };
}
