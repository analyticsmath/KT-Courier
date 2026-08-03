import { EditorialOperationsShell } from "@/components/protected-v2/shell/EditorialOperationsShell";
import type {
  ProtectedApplicationContext,
  ProtectedIconName,
  ProtectedNavigationGroup,
} from "@/components/protected-v2/navigation/types";
import type { NavItem } from "@/types/navigation";

/** Legacy input contract retained for gradual protected-route migration. */
export interface DashboardShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  navTitle?: string;
  userName?: string;
  userRole?: string;
  primaryAction?: { label: string; href: string };
  sidebarFooter?: React.ReactNode;
  productMode?: "CUSTOMER" | "ADMIN" | "DRIVER" | "STORE" | "PAYMENT" | "NONE";
}

const productContext: Record<NonNullable<DashboardShellProps["productMode"]>, ProtectedApplicationContext> = {
  CUSTOMER: "CUSTOMER",
  ADMIN: "ADMIN",
  DRIVER: "DRIVER",
  STORE: "STORE",
  PAYMENT: "CUSTOMER",
  NONE: "CUSTOMER",
};

const legacyIconByLabel: Record<string, ProtectedIconName> = {
  Dashboard: "home",
  Overview: "home",
  Orders: "clipboard",
  "My Deliveries": "package",
  "Request Delivery": "plus",
  "New Delivery": "plus",
  Wallet: "wallet",
  Earnings: "wallet",
  Notifications: "bell",
  Support: "support",
  "My Profile": "people",
  "Account Settings": "people",
  "Store Settings": "store",
  "Product Catalog": "archive",
  Catalog: "archive",
  Availability: "activity",
  Assignments: "route",
};

/**
 * @deprecated R13 compatibility adapter. New layouts should use the
 * server-filtered protected-navigation registry directly.
 */
export function DashboardShell({
  children,
  navItems,
  navTitle,
  userName,
  userRole,
  primaryAction,
  sidebarFooter,
  productMode = "NONE",
}: DashboardShellProps) {
  const context = productContext[productMode];
  const items = navItems.map((item, index) => ({
    id: `legacy-${index}-${item.href}`,
    label: item.label,
    href: item.href,
    icon: legacyIconByLabel[item.label] ?? "file",
    group: navTitle ?? "Navigation",
    exact: item.href === "/account" || item.href === "/store" || item.href === "/driver" || item.href === "/admin",
    mobilePriority: (context === "CUSTOMER" || context === "DRIVER") && index < 5 ? index + 1 : undefined,
    contexts: [context],
  } as const));
  const navigation: readonly ProtectedNavigationGroup[] = [{ id: "legacy-navigation", label: navTitle ?? "Navigation", items }];

  return (
    <EditorialOperationsShell
      context={context}
      contextLabel={navTitle ?? "KT Couriers"}
      mobileNavigation={items.filter((item) => item.mobilePriority !== undefined)}
      navigation={navigation}
      navigationFooter={sidebarFooter}
      primaryAction={primaryAction}
      user={{ displayName: userName ?? "User", roleLabel: userRole ?? "" }}
    >
      {children}
    </EditorialOperationsShell>
  );
}
