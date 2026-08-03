import type { NavItem } from "@/types/navigation";

export const PUBLIC_NAV: NavItem[] = [
  { label: "Services", href: "/services" },
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
];

export const PUBLIC_NAV_AUTH: NavItem[] = [
  { label: "Login", href: "/login" },
];

export const ACCOUNT_NAV: NavItem[] = [
  { label: "Dashboard", href: "/account" },
  { label: "Request Delivery", href: "/account/request-delivery" },
  { label: "My Deliveries", href: "/account/orders" },
  { label: "Wallet", href: "/account/wallet" },
  { label: "Refunds", href: "/account/refunds" },
  { label: "Saved Addresses", href: "/account/addresses" },
  { label: "Notifications", href: "/account/notifications" },
  { label: "Account Settings", href: "/account/profile" },
  { label: "Support", href: "/account/support" },
];

export const STORE_NAV: NavItem[] = [
  { label: "Dashboard", href: "/store" },
  { label: "Product Catalog", href: "/store/catalog" },
  { label: "Earnings", href: "/store/earnings" },
  { label: "New Delivery", href: "/store/new-delivery" },
  { label: "Orders", href: "/store/orders" },
  { label: "Store Settings", href: "/store/profile" },
  { label: "Advertising", href: "/store/advertising" },
  { label: "Support", href: "/store/support" },
  { label: "Notifications", href: "/store/notifications" },
];

export const ADMIN_NAV: NavItem[] = [
  { label: "Overview", href: "/admin" },
  { label: "Catalog", href: "/admin/catalog" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Dispatch", href: "/admin/dispatch" },
  { label: "Employees", href: "/admin/employees" },
  { label: "Customers", href: "/admin/users" },
  { label: "Stores", href: "/admin/stores" },
  { label: "Drivers", href: "/admin/drivers" },
  { label: "Regions", href: "/admin/regions" },
  { label: "Pricing", href: "/admin/pricing" },
  { label: "Ledger", href: "/admin/ledger" },
  { label: "Payments", href: "/admin/payments" },
  { label: "Payment Providers", href: "/admin/payment-providers" },
  { label: "Payment Webhooks", href: "/admin/payment-webhooks" },
  { label: "Payment Reconciliation", href: "/admin/payment-reconciliation" },
  { label: "Commission Plans", href: "/admin/commission-plans" },
  { label: "Commissions", href: "/admin/commissions" },
  { label: "Commission Reconciliation", href: "/admin/commission-reconciliation" },
  { label: "Store Earnings", href: "/admin/store-earnings" },
  { label: "Store Earning Reconciliation", href: "/admin/store-earning-reconciliation" },
  { label: "Driver Earnings", href: "/admin/driver-earnings" },
  { label: "Driver Earning Reconciliation", href: "/admin/driver-earning-reconciliation" },
  { label: "Refunds", href: "/admin/refunds" },
  { label: "Refund Reconciliation", href: "/admin/refund-reconciliation" },
  { label: "Advertising", href: "/admin/advertising" },
  { label: "Emails", href: "/admin/emails" },
  { label: "Notifications", href: "/admin/notifications" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Permissions", href: "/admin/permissions" },
  { label: "Activity", href: "/admin/activity" },
];

export const DRIVER_NAV: NavItem[] = [
  { label: "Dashboard", href: "/driver" },
  { label: "Earnings", href: "/driver/earnings" },
  { label: "Assignments", href: "/driver/assignments" },
  { label: "My Profile", href: "/driver/profile" },
  { label: "Availability", href: "/driver/availability" },
  { label: "Notifications", href: "/driver/notifications" },
];
